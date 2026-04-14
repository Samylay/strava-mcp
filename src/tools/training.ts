import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  StravaApiError,
  getActivities,
  getAthleteCached,
  getAthleteZonesCached,
} from '../strava-client.js';
import {
  formatDistance,
  formatDuration,
  formatPace,
  startOfWeek,
  toUnixTimestamp,
  weeksAgo,
} from '../utils/dates.js';
import {
  classifyHeartRate,
  computeIntensityDistribution,
  defaultZones,
  intensityLabel,
} from '../utils/zones.js';
import type { StravaHRZone, StravaSummaryActivity } from '../types.js';

function resolveHrZones(zones: StravaHRZone[] | undefined): StravaHRZone[] {
  return zones && zones.length > 0 ? zones : defaultZones();
}

async function fetchActivitiesInRange(after: Date, before: Date): Promise<StravaSummaryActivity[]> {
  const activities: StravaSummaryActivity[] = [];
  let page = 1;

  while (true) {
    const batch = await getActivities({
      after: toUnixTimestamp(after),
      before: toUnixTimestamp(before),
      per_page: 200,
      page,
    });

    activities.push(...batch);

    if (batch.length < 200) {
      break;
    }

    page += 1;
  }

  return activities;
}

function createWeekKey(activity: StravaSummaryActivity): string {
  return startOfWeek(new Date(activity.start_date)).toISOString().slice(0, 10);
}

export async function buildTrainingSummary(params: { weeks: number; sportType: string }) {
  const { weeks, sportType } = params;
  const [athlete, zonesData] = await Promise.all([
    getAthleteCached(),
    getAthleteZonesCached(),
  ]);
  const preference = athlete.measurement_preference;
  const heartRateZones = resolveHrZones(zonesData.heart_rate?.zones);

  const activities = await fetchActivitiesInRange(weeksAgo(weeks), new Date());
  const filteredActivities = sportType === 'all'
    ? activities
    : activities.filter((activity) => activity.sport_type.toLowerCase() === sportType.toLowerCase());

  if (filteredActivities.length === 0) {
    return { weeks: [], message: `No activities found in the last ${weeks} weeks.` };
  }

  const weekMap = new Map<string, StravaSummaryActivity[]>();
  for (const activity of filteredActivities) {
    const key = createWeekKey(activity);
    const bucket = weekMap.get(key);
    if (bucket) {
      bucket.push(activity);
    } else {
      weekMap.set(key, [activity]);
    }
  }

  const weekRows = Array.from(weekMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([weekStart, weekActivities]) => {
      const totalDistance = weekActivities.reduce((sum, activity) => sum + activity.distance, 0);
      const totalTime = weekActivities.reduce((sum, activity) => sum + activity.moving_time, 0);
      const totalElevation = weekActivities.reduce(
        (sum, activity) => sum + activity.total_elevation_gain,
        0,
      );
      const averageSpeed = totalTime > 0 ? totalDistance / totalTime : 0;
      const hrValues = weekActivities
        .map((activity) => activity.average_heartrate)
        .filter((value): value is number => value != null);
      const averageHeartRate = hrValues.length > 0
        ? Math.round(hrValues.reduce((sum, value) => sum + value, 0) / hrValues.length)
        : null;
      const intensity = computeIntensityDistribution(hrValues, heartRateZones);
      const activityDays = new Set(
        weekActivities.map((activity) => activity.start_date.slice(0, 10)),
      );

      return {
        weekStart,
        activityCount: weekActivities.length,
        totalDistance: formatDistance(totalDistance, preference),
        totalTime: formatDuration(totalTime),
        totalElevation: formatDistance(totalElevation, preference),
        avgPace: formatPace(averageSpeed, preference),
        avgHR: averageHeartRate ?? 'n/a',
        intensity,
        intensitySummary: hrValues.length > 0 ? intensityLabel(intensity) : 'no HR data',
        restDays: 7 - activityDays.size,
      };
    });

  return { weeks: weekRows, message: null };
}

export async function buildFitnessTrends(params: { weeks: number }) {
  const { weeks } = params;
  const athlete = await getAthleteCached();
  const preference = athlete.measurement_preference;
  const activities = await fetchActivitiesInRange(weeksAgo(weeks), new Date());

  if (activities.length === 0) {
    return { weeks: [], message: `No activities found in the last ${weeks} weeks.` };
  }

  const weekMap = new Map<string, StravaSummaryActivity[]>();
  for (const activity of activities) {
    const key = createWeekKey(activity);
    const bucket = weekMap.get(key);
    if (bucket) {
      bucket.push(activity);
    } else {
      weekMap.set(key, [activity]);
    }
  }

  const weeksData = Array.from(weekMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([weekStart, weekActivities]) => {
      const totalDistance = weekActivities.reduce((sum, activity) => sum + activity.distance, 0);
      const totalTime = weekActivities.reduce((sum, activity) => sum + activity.moving_time, 0);

      return {
        weekStart,
        totalDistance,
        totalDistanceFormatted: formatDistance(totalDistance, preference),
        totalTime,
        activityCount: weekActivities.length,
        sportBreakdown: weekActivities.reduce<Record<string, number>>((breakdown, activity) => {
          breakdown[activity.sport_type] = (breakdown[activity.sport_type] ?? 0) + 1;
          return breakdown;
        }, {}),
      };
    });

  const weeksWithRollingAverage = weeksData.map((week, index) => {
    const window = weeksData.slice(Math.max(0, index - 3), index + 1);
    const rollingAverageDistance = window.reduce((sum, item) => sum + item.totalDistance, 0) / window.length;

    return {
      ...week,
      rollingAvgDistance: formatDistance(rollingAverageDistance, preference),
    };
  });

  const last4Distance = weeksData.slice(-4).reduce((sum, week) => sum + week.totalDistance, 0);
  const prior4Distance = weeksData.slice(-8, -4).reduce((sum, week) => sum + week.totalDistance, 0);

  let trend = 'insufficient data';
  if (prior4Distance > 0) {
    if (last4Distance > prior4Distance * 1.05) {
      trend = 'increasing';
    } else if (last4Distance < prior4Distance * 0.95) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }
  }

  const uniqueDays = Array.from(new Set(activities.map((activity) => activity.start_date.slice(0, 10)))).sort();
  let longestStreak = uniqueDays.length > 0 ? 1 : 0;
  let currentStreak = uniqueDays.length > 0 ? 1 : 0;

  for (let index = 1; index < uniqueDays.length; index += 1) {
    const previous = new Date(`${uniqueDays[index - 1]}T00:00:00Z`);
    const current = new Date(`${uniqueDays[index]}T00:00:00Z`);
    const diffDays = (current.getTime() - previous.getTime()) / 86400000;

    if (diffDays === 1) {
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  const biggestWeek = weeksData.reduce((best, week) => (
    week.totalDistance > best.totalDistance ? week : best
  ));

  return {
    weeks: weeksWithRollingAverage,
    trend,
    longestStreakDays: longestStreak,
    biggestWeek: {
      weekStart: biggestWeek.weekStart,
      distance: formatDistance(biggestWeek.totalDistance, preference),
    },
    message: null,
  };
}

export function registerTrainingTools(server: McpServer): void {
  server.tool(
    'get_training_summary',
    'Pre-aggregated weekly training breakdown with distance, time, pace, heart rate, intensity distribution, and rest days.',
    {
      weeks: z.number().int().min(1).max(52).default(4),
      sport_type: z.enum(['run', 'ride', 'swim', 'all']).default('all'),
    },
    async ({ weeks, sport_type }) => {
      try {
        const summary = await buildTrainingSummary({ weeks, sportType: sport_type });
        return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
      } catch (error) {
        if (error instanceof StravaApiError) {
          return { content: [{ type: 'text', text: error.message }] };
        }

        throw error;
      }
    },
  );

  server.tool(
    'get_fitness_trends',
    'Longer-term training trend analysis with rolling weekly volume, biggest week, and active streaks.',
    {
      weeks: z.number().int().min(4).max(52).default(12),
    },
    async ({ weeks }) => {
      try {
        const trends = await buildFitnessTrends({ weeks });
        return { content: [{ type: 'text', text: JSON.stringify(trends, null, 2) }] };
      } catch (error) {
        if (error instanceof StravaApiError) {
          return { content: [{ type: 'text', text: error.message }] };
        }

        throw error;
      }
    },
  );
}
