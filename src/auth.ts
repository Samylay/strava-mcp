interface TokenState {
  accessToken: string;
  expiresAt: number; // Unix seconds
}

export class StravaAuth {
  private state: TokenState | null = null;
  private refreshPromise: Promise<void> | null = null;

  async getAccessToken(): Promise<string> {
    if (this.isValid()) return this.state!.accessToken;
    await this.refresh();
    return this.state!.accessToken;
  }

  private isValid(): boolean {
    if (!this.state) return false;
    // Treat as expired if within 5 minutes of actual expiry
    return Date.now() / 1000 < this.state.expiresAt - 300;
  }

  private async refresh(): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.doRefresh().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async doRefresh(): Promise<void> {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    const refreshToken = process.env.STRAVA_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        'Missing required env vars: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN. Run `npm run setup`.'
      );
    }

    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json() as { access_token: string; expires_at: number };
    this.state = { accessToken: data.access_token, expiresAt: data.expires_at };
  }
}

export const auth = new StravaAuth();
