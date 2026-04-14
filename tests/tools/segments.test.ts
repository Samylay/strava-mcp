import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StravaStarredSegment } from '../../src/types.js';

vi.mock('../../src/strava-client.js', () => ({
  getStarredSegments: vi.fn(),
  getAthleteCached: vi.fn(),
  StravaApiError: class StravaApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
}));

const client = await import('../../src/strava-client.js');
const { buildSegmentEfforts } = await import('../../src/tools/segments.js');

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

const mockSegment: StravaStarredSegment = {
  id: 1,
  name: 'Alpe d\'Huez',
  distance: 14000,
  average_grade: 8.1,
  athlete_segment_stats: {
    pr_elapsed_time: 3600,
    pr_date: '2024-01-15',
    effort_count: 5,
  },
  xoms: { kom: '45:00', qom: '52:00', overall: '45:00' },
};

describe('buildSegmentEfforts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(client.getAthleteCached).mockResolvedValue(mockAthlete);
  });

  it('returns no segments message when list is empty', async () => {
    vi.mocked(client.getStarredSegments).mockResolvedValue([]);

    const result = await buildSegmentEfforts();
    expect(result.message).toContain('No starred segments');
  });

  it('formats segment name, distance and grade', async () => {
    vi.mocked(client.getStarredSegments).mockResolvedValue([mockSegment]);

    const result = await buildSegmentEfforts();
    expect(result.segments[0].name).toBe('Alpe d\'Huez');
    expect(result.segments[0].distance).toBe('14.00 km');
    expect(result.segments[0].avgGrade).toBe('8.1%');
  });

  it('includes PR time and effort count', async () => {
    vi.mocked(client.getStarredSegments).mockResolvedValue([mockSegment]);

    const result = await buildSegmentEfforts();
    expect(result.segments[0].prTime).toBe('1h 0m');
    expect(result.segments[0].effortCount).toBe(5);
  });
});
