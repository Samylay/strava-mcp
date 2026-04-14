import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StravaGear } from '../../src/types.js';

vi.mock('../../src/strava-client.js', () => ({
  getAthleteCached: vi.fn(),
  getGear: vi.fn(),
  StravaApiError: class StravaApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
}));

const client = await import('../../src/strava-client.js');
const { buildGearSummary } = await import('../../src/tools/gear.js');

const mockGear: StravaGear = {
  id: 'g1',
  name: 'Nike Pegasus 41',
  brand_name: 'Nike',
  model_name: 'Pegasus 41',
  distance: 500000,
  retired: false,
  resource_state: 3,
};

describe('buildGearSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(client.getAthleteCached).mockResolvedValue({
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
      shoes: [{ id: 'g1', name: 'Nike Pegasus 41', primary: true, distance: 500000, retired: false }],
    });
    vi.mocked(client.getGear).mockResolvedValue(mockGear);
  });

  it('returns gear with formatted distance', async () => {
    const result = await buildGearSummary();

    expect(result.shoes).toHaveLength(1);
    expect(result.shoes[0].name).toBe('Nike Pegasus 41');
    expect(result.shoes[0].distance).toBe('500.00 km');
  });

  it('includes brand and model', async () => {
    const result = await buildGearSummary();

    expect(result.shoes[0].brand).toBe('Nike');
    expect(result.shoes[0].model).toBe('Pegasus 41');
  });

  it('marks primary gear', async () => {
    const result = await buildGearSummary();
    expect(result.shoes[0].primary).toBe(true);
  });

  it('returns empty arrays when no gear', async () => {
    vi.mocked(client.getAthleteCached).mockResolvedValue({
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
    });

    const result = await buildGearSummary();
    expect(result.bikes).toHaveLength(0);
    expect(result.shoes).toHaveLength(0);
  });
});
