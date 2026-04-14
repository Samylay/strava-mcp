import 'dotenv/config';
import { exec } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const clientId = process.env.STRAVA_CLIENT_ID;
const clientSecret = process.env.STRAVA_CLIENT_SECRET;
const redirectUri = 'http://localhost:8080/callback';

if (!clientId || !clientSecret) {
  console.error(
    'Error: STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set.\n'
    + 'Copy .env.example to .env and fill in your Strava app credentials from https://www.strava.com/settings/api',
  );
  process.exit(1);
}

const authUrl = new URL('https://www.strava.com/oauth/authorize');
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('redirect_uri', redirectUri);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('approval_prompt', 'force');
authUrl.searchParams.set('scope', 'read,activity:read_all');

function openBrowser(url: string): void {
  const command = process.platform === 'darwin'
    ? `open "${url}"`
    : process.platform === 'win32'
      ? `start "" "${url}"`
      : `xdg-open "${url}"`;

  exec(command, (error) => {
    if (error) {
      console.warn('Could not open the browser automatically. Open this URL manually:');
      console.warn(url);
    }
  });
}

function upsertEnvValue(content: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');

  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }

  const trimmed = content.trimEnd();
  return trimmed.length > 0 ? `${trimmed}\n${line}\n` : `${line}\n`;
}

function saveRefreshToken(refreshToken: string): void {
  const envPath = '.env';
  const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';

  let next = existing;
  next = upsertEnvValue(next, 'STRAVA_CLIENT_ID', clientId);
  next = upsertEnvValue(next, 'STRAVA_CLIENT_SECRET', clientSecret);
  next = upsertEnvValue(next, 'STRAVA_REFRESH_TOKEN', refreshToken);

  writeFileSync(envPath, next);
}

console.log('\nOpening Strava authorization page...');
console.log('If the browser does not open, visit:\n');
console.log(authUrl.toString());
console.log('');

openBrowser(authUrl.toString());

const code = await new Promise<string>((resolve, reject) => {
  const server = createServer((req, res) => {
    if (!req.url?.startsWith('/callback')) {
      res.writeHead(404);
      res.end();
      return;
    }

    const callbackUrl = new URL(req.url, redirectUri);
    const callbackCode = callbackUrl.searchParams.get('code');
    const error = callbackUrl.searchParams.get('error');

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<h1>Error: ${error}</h1><p>You can close this tab.</p>`);
      server.close();
      reject(new Error(`Strava authorization denied: ${error}`));
      return;
    }

    if (!callbackCode) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h1>Error: no code received</h1><p>You can close this tab.</p>');
      server.close();
      reject(new Error('No authorization code in callback.'));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Authorization successful.</h1><p>You can close this tab and return to the terminal.</p>');
    server.close();
    resolve(callbackCode);
  });

  server.listen(8080, () => {
    console.log(`Waiting for Strava callback on ${redirectUri}...`);
  });

  server.on('error', reject);
});

console.log('\nExchanging code for tokens...');

const response = await fetch('https://www.strava.com/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
  }),
});

if (!response.ok) {
  console.error(`Token exchange failed: ${response.status}`);
  console.error(await response.text());
  process.exit(1);
}

const tokens = await response.json() as {
  athlete: { firstname: string; lastname: string };
  refresh_token: string;
};

saveRefreshToken(tokens.refresh_token);

console.log(`\nAuthenticated as: ${tokens.athlete.firstname} ${tokens.athlete.lastname}`);
console.log('Refresh token saved to .env');
console.log('\nYou can now start the MCP server with: npm run dev');
