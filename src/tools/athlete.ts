import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAthlete, getAthleteStats, StravaApiError } from '../strava-client.js';
import { formatDistance, formatDuration } from '../utils/dates.js';
import type { StravaTotals } from '../types.js';

function formatTotals(totals: StravaTotals, preference: 'feet' | 'meters') {
  return {
    count: totals.count,
    distance: formatDistance(totals.distance, preference),
    time: formatDuration(totals.moving_time),
    elevation: formatDistance(totals.elevation_gain, preference),
  };
}

export async function buildAthleteProfile() {
  const athlete = await getAthlete();
  const stats = await getAthleteStats(athlete.id);
  const preference = athlete.measurement_preference;

  return {
    name: `${athlete.firstname} ${athlete.lastname}`.trim(),
    username: athlete.username,
    location: [athlete.city, athlete.country].filter(Boolean).join(', '),
    profile: athlete.profile,
    followers: athlete.follower_count,
    following: athlete.friend_count,
    recentRuns: formatTotals(stats.recent_run_totals, preference),
    recentRides: formatTotals(stats.recent_ride_totals, preference),
    recentSwims: formatTotals(stats.recent_swim_totals, preference),
    ytd: {
      runs: formatTotals(stats.ytd_run_totals, preference),
      rides: formatTotals(stats.ytd_ride_totals, preference),
      swims: formatTotals(stats.ytd_swim_totals, preference),
    },
    allTime: {
      runs: formatTotals(stats.all_run_totals, preference),
      rides: formatTotals(stats.all_ride_totals, preference),
      swims: formatTotals(stats.all_swim_totals, preference),
    },
  };
}

export function registerAthleteTools(server: McpServer): void {
  server.tool(
    'get_athlete_profile',
    'Get Strava athlete profile with all-time stats, year-to-date totals, and recent totals for runs, rides, and swims.',
    {},
    async () => {
      try {
        const profile = await buildAthleteProfile();
        return { content: [{ type: 'text', text: JSON.stringify(profile, null, 2) }] };
      } catch (error) {
        if (error instanceof StravaApiError) {
          return { content: [{ type: 'text', text: error.message }] };
        }

        throw error;
      }
    },
  );
}
