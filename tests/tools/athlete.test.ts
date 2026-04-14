import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StravaAthlete, StravaAthleteStats } from '../../src/types.js';

vi.mock('../../src/strava-client.js', () => ({
  getAthlete: vi.fn(),
  getAthleteStats: vi.fn(),
}));

const client = await import('../../src/strava-client.js');
const { buildAthleteProfile } = await import('../../src/tools/athlete.js');

const mockAthlete: StravaAthlete = {
  id: 123,
  username: 'jdoe',
  firstname: 'John',
  lastname: 'Doe',
  city: 'Paris',
  country: 'France',
  profile: 'https://example.com/photo.jpg',
  follower_count: 42,
  friend_count: 38,
  measurement_preference: 'meters',
  bikes: [],
  shoes: [],
};

const mockStats: StravaAthleteStats = {
  recent_run_totals: { count: 5, distance: 50000, moving_time: 18000, elapsed_time: 19000, elevation_gain: 500 },
  recent_ride_totals: { count: 0, distance: 0, moving_time: 0, elapsed_time: 0, elevation_gain: 0 },
  recent_swim_totals: { count: 0, distance: 0, moving_time: 0, elapsed_time: 0, elevation_gain: 0 },
  ytd_run_totals: { count: 50, distance: 500000, moving_time: 180000, elapsed_time: 190000, elevation_gain: 5000 },
  ytd_ride_totals: { count: 0, distance: 0, moving_time: 0, elapsed_time: 0, elevation_gain: 0 },
  ytd_swim_totals: { count: 0, distance: 0, moving_time: 0, elapsed_time: 0, elevation_gain: 0 },
  all_run_totals: { count: 300, distance: 3000000, moving_time: 1080000, elapsed_time: 1100000, elevation_gain: 30000 },
  all_ride_totals: { count: 0, distance: 0, moving_time: 0, elapsed_time: 0, elevation_gain: 0 },
  all_swim_totals: { count: 0, distance: 0, moving_time: 0, elapsed_time: 0, elevation_gain: 0 },
};

describe('buildAthleteProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(client.getAthlete).mockResolvedValue(mockAthlete);
    vi.mocked(client.getAthleteStats).mockResolvedValue(mockStats);
  });

  it('includes athlete name and location', async () => {
    const result = await buildAthleteProfile();
    expect(result.name).toBe('John Doe');
    expect(result.location).toBe('Paris, France');
  });

  it('includes follower counts', async () => {
    const result = await buildAthleteProfile();
    expect(result.followers).toBe(42);
    expect(result.following).toBe(38);
  });

  it('formats all-time run distance in km for metric preference', async () => {
    const result = await buildAthleteProfile();
    expect(result.allTime.runs.distance).toBe('3000.00 km');
  });

  it('calls getAthleteStats with the athlete id', async () => {
    await buildAthleteProfile();
    expect(client.getAthleteStats).toHaveBeenCalledWith(123);
  });
});
