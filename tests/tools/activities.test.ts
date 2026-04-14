import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StravaDetailedActivity, StravaSummaryActivity } from '../../src/types.js';

vi.mock('../../src/strava-client.js', () => ({
  getActivities: vi.fn(),
  getActivity: vi.fn(),
  getAthleteCached: vi.fn(),
  getAthleteZonesCached: vi.fn(),
  StravaApiError: class StravaApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
}));

const client = await import('../../src/strava-client.js');
const { buildActivityDetail, buildRecentActivities } = await import('../../src/tools/activities.js');

const mockAthlete = {
  id: 1,
  username: 't',
  firstname: 'T',
  lastname: 'T',
  city: '',
  country: '',
  profile: '',
  follower_count: 0,
  friend_count: 0,
  measurement_preference: 'meters' as const,
  bikes: [],
  shoes: [],
};

const mockActivity: StravaSummaryActivity = {
  id: 100,
  name: 'Morning Run',
  type: 'Run',
  sport_type: 'Run',
  start_date: '2024-04-08T07:00:00Z',
  start_date_local: '2024-04-08T08:00:00+01:00',
  distance: 10000,
  moving_time: 3600,
  elapsed_time: 3700,
  total_elevation_gain: 100,
  average_speed: 2.778,
  max_speed: 4,
  average_heartrate: 145,
  suffer_score: 80,
};

describe('buildRecentActivities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(client.getAthleteCached).mockResolvedValue(mockAthlete);
    vi.mocked(client.getActivities).mockResolvedValue([mockActivity]);
  });

  it('returns formatted activity list', async () => {
    const result = await buildRecentActivities(5);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(100);
    expect(result[0].name).toBe('Morning Run');
    expect(result[0].distance).toBe('10.00 km');
    expect(result[0].movingTime).toBe('1h 0m');
  });

  it('includes HR and suffer score', async () => {
    const result = await buildRecentActivities(5);

    expect(result[0].avgHR).toBe(145);
    expect(result[0].sufferScore).toBe(80);
  });
});

describe('buildActivityDetail', () => {
  const mockDetailed: StravaDetailedActivity = {
    ...mockActivity,
    splits_metric: [
      { distance: 1000, elapsed_time: 360, moving_time: 358, average_speed: 2.79, split: 1 },
    ],
    best_efforts: [
      { name: '1k', elapsed_time: 360, distance: 1000, start_date_local: '2024-04-08T08:00:00+01:00', pr_rank: 1 },
    ],
    segment_efforts: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(client.getAthleteCached).mockResolvedValue(mockAthlete);
    vi.mocked(client.getAthleteZonesCached).mockResolvedValue({ heart_rate: undefined });
    vi.mocked(client.getActivity).mockResolvedValue(mockDetailed);
  });

  it('includes splits', async () => {
    const result = await buildActivityDetail(100);

    expect(result.splits).toHaveLength(1);
    expect(result.splits[0].split).toBe(1);
  });

  it('includes best efforts', async () => {
    const result = await buildActivityDetail(100);

    expect(result.bestEfforts).toHaveLength(1);
    expect(result.bestEfforts[0].name).toBe('1k');
  });
});
