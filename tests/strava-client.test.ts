import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.STRAVA_CLIENT_ID = 'test_client_id';
process.env.STRAVA_CLIENT_SECRET = 'test_client_secret';
process.env.STRAVA_REFRESH_TOKEN = 'test_refresh_token';

vi.mock('../src/auth.js', () => ({
  auth: { getAccessToken: vi.fn().mockResolvedValue('mock_token') },
}));

const { getAthlete, getAthleteStats, getActivities, getActivity,
        getAthleteZones, getStarredSegments, getGear,
        getAthleteCached, getAthleteZonesCached,
        StravaApiError } = await import('../src/strava-client.js');

describe('StravaApiError', () => {
  it('is an instance of Error with status', () => {
    const err = new StravaApiError(429, 'rate limited');
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(429);
    expect(err.message).toBe('rate limited');
  });
});

describe('strava-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the correct endpoint with Bearer token', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 1, firstname: 'Test' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await getAthlete();

    expect(result).toEqual({ id: 1, firstname: 'Test' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.strava.com/api/v3/athlete',
      expect.objectContaining({
        headers: { Authorization: 'Bearer mock_token' },
      })
    );
  });

  it('throws StravaApiError with minutes remaining on 429', async () => {
    const resetAt = Math.floor(Date.now() / 1000) + 900; // 15 minutes
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: (h: string) => h === 'X-RateLimit-Reset' ? String(resetAt) : null },
    }));

    await expect(getAthlete()).rejects.toThrow(StravaApiError);
    await expect(getAthlete()).rejects.toMatchObject({ status: 429 });
  });

  it('throws StravaApiError with auth message on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => null },
    }));

    const err = await getAthlete().catch(e => e);
    expect(err).toBeInstanceOf(StravaApiError);
    expect(err.status).toBe(401);
    expect(err.message).toContain('authentication failed');
  });

  it('builds activity query string correctly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });
    vi.stubGlobal('fetch', mockFetch);

    await getActivities({ after: 1000, per_page: 50, page: 2 });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('after=1000');
    expect(url).toContain('per_page=50');
    expect(url).toContain('page=2');
  });
});
