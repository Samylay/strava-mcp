import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StravaApiError, getAthleteCached, getStarredSegments } from '../strava-client.js';
import { formatDistance, formatDuration } from '../utils/dates.js';

export async function buildSegmentEfforts() {
  const [athlete, segments] = await Promise.all([
    getAthleteCached(),
    getStarredSegments(),
  ]);

  if (segments.length === 0) {
    return {
      segments: [],
      message: 'No starred segments found. Star segments on Strava to track them here.',
    };
  }

  const preference = athlete.measurement_preference;

  return {
    segments: segments.slice(0, 20).map((segment) => ({
      id: segment.id,
      name: segment.name,
      distance: formatDistance(segment.distance, preference),
      avgGrade: `${segment.average_grade}%`,
      effortCount: segment.athlete_segment_stats?.effort_count ?? 0,
      prTime: segment.athlete_segment_stats?.pr_elapsed_time != null
        ? formatDuration(segment.athlete_segment_stats.pr_elapsed_time)
        : null,
      prDate: segment.athlete_segment_stats?.pr_date ?? null,
      kom: segment.xoms?.kom ?? null,
      qom: segment.xoms?.qom ?? null,
    })),
    message: null,
  };
}

export function registerSegmentTools(server: McpServer): void {
  server.tool(
    'get_segment_efforts',
    'List starred Strava segments with PR times, effort counts, and KOM/QOM benchmarks.',
    {},
    async () => {
      try {
        const result = await buildSegmentEfforts();
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        if (error instanceof StravaApiError) {
          return { content: [{ type: 'text', text: error.message }] };
        }

        throw error;
      }
    },
  );
}
