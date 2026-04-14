import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StravaAthleteZones, StravaSummaryActivity } from '../../src/types.js';

vi.mock('../../src/strava-client.js', () => ({
  getActivities: vi.fn(),
  getAthleteCached: vi.fn(),
  getAthleteZonesCached: vi.fn(),
  StravaApiError: class StravaApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
}));

const client = await import('../../src/strava-client.js');
const { buildTrainingSummary } = await import('../../src/tools/training.js');

const mockZones: StravaAthleteZones = {
  heart_rate: {
    custom_zones: false,
    zones: [
      { min: 0, max: 115 },
      { min: 115, max: 152 },
      { min: 152, max: 171 },
      { min: 171, max: 190 },
      { min: 190, max: -1 },
    ],
  },
};

function makeActivity(overrides: Partial<StravaSummaryActivity> = {}): StravaSummaryActivity {
  return {
    id: 1,
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
    ...overrides,
  };
}

describe('buildTrainingSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(client.getAthleteCached).mockResolvedValue({
      id: 1,
      username: 'test',
      firstname: 'T',
      lastname: 'T',
      city: '',
      country: '',
      profile: '',
      follower_count: 0,
      friend_count: 0,
      measurement_preference: 'meters',
      bikes: [],
      shoes: [],
    });
    vi.mocked(client.getAthleteZonesCached).mockResolvedValue(mockZones);
  });

  it('returns empty weeks message when no activities', async () => {
    vi.mocked(client.getActivities).mockResolvedValue([]);

    const result = await buildTrainingSummary({ weeks: 1, sportType: 'all' });

    expect(result.weeks).toHaveLength(0);
    expect(result.message).toContain('No activities');
  });

  it('groups activities into correct week', async () => {
    vi.mocked(client.getActivities).mockResolvedValue([
      makeActivity({ start_date: '2024-04-08T07:00:00Z', distance: 10000 }),
    ]);

    const result = await buildTrainingSummary({ weeks: 4, sportType: 'all' });
    const week = result.weeks.find((item) => item.weekStart.startsWith('2024-04-08'));

    expect(week).toBeDefined();
    expect(week?.activityCount).toBe(1);
    expect(week?.totalDistance).toBe('10.00 km');
  });

  it('filters by sport type', async () => {
    const run = makeActivity({ sport_type: 'Run' });
    const ride = makeActivity({ id: 2, sport_type: 'Ride', start_date: '2024-04-08T09:00:00Z' });
    vi.mocked(client.getActivities).mockResolvedValue([run, ride]);

    const result = await buildTrainingSummary({ weeks: 4, sportType: 'run' });
    const week = result.weeks.find((item) => item.activityCount > 0);

    expect(week?.activityCount).toBe(1);
  });

  it('computes intensity distribution from HR', async () => {
    vi.mocked(client.getActivities).mockResolvedValue([
      makeActivity({ average_heartrate: 130 }),
    ]);

    const result = await buildTrainingSummary({ weeks: 4, sportType: 'all' });
    const week = result.weeks.find((item) => item.activityCount > 0);

    expect(week?.intensity.easy).toBeGreaterThan(0);
    expect(week?.intensity.hard).toBe(0);
  });
});
