interface TokenState {
  accessToken: string;
  expiresAt: number; // Unix seconds
}

export class StravaAuth {
  private state: TokenState | null = null;

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
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        refresh_token: process.env.STRAVA_REFRESH_TOKEN,
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
