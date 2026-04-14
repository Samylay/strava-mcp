import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must set env before importing module
process.env.STRAVA_CLIENT_ID = 'test_client_id';
process.env.STRAVA_CLIENT_SECRET = 'test_client_secret';
process.env.STRAVA_REFRESH_TOKEN = 'test_refresh_token';

const { StravaAuth } = await import('../src/auth.js');

describe('StravaAuth', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches a new token when none is cached', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new_access_token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const auth = new StravaAuth();
    const token = await auth.getAccessToken();

    expect(token).toBe('new_access_token');
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.strava.com/oauth/token',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('reuses cached token if not expiring within 5 minutes', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'cached_token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const auth = new StravaAuth();
    await auth.getAccessToken();
    await auth.getAccessToken();

    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('refreshes token when it expires within 5 minutes', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        access_token: `token_${++callCount}`,
        expires_at: Math.floor(Date.now() / 1000) + 200, // 3m20s — within 5m window
      }),
    }));
    vi.stubGlobal('fetch', mockFetch);

    const auth = new StravaAuth();
    const first = await auth.getAccessToken();
    const second = await auth.getAccessToken();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(first).toBe('token_1');
    expect(second).toBe('token_2');
  });

  it('throws when token refresh fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
    }));

    const auth = new StravaAuth();
    await expect(auth.getAccessToken()).rejects.toThrow('Token refresh failed: 400');
  });
});
