import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  StravaApiError,
  getActivities,
  getActivity,
  getAthleteCached,
  getAthleteZonesCached,
} from '../strava-client.js';
import { formatDistance, formatDuration, formatPace } from '../utils/dates.js';
import { classifyHeartRate, defaultZones } from '../utils/zones.js';
import type { StravaHRZone } from '../types.js';

function resolveHrZones(zones: StravaHRZone[] | undefined): StravaHRZone[] {
  return zones && zones.length > 0 ? zones : defaultZones();
}

export async function buildRecentActivities(limit: number) {
  const athlete = await getAthleteCached();
  const preference = athlete.measurement_preference;
  const activities = await getActivities({ per_page: limit, page: 1 });

  return activities.map((activity) => ({
    id: activity.id,
    name: activity.name,
    date: activity.start_date_local.slice(0, 10),
    sportType: activity.sport_type,
    distance: formatDistance(activity.distance, preference),
    movingTime: formatDuration(activity.moving_time),
    avgPace: formatPace(activity.average_speed, preference),
    avgHR: activity.average_heartrate ?? null,
    elevationGain: formatDistance(activity.total_elevation_gain, preference),
    sufferScore: activity.suffer_score ?? null,
  }));
}

export async function buildActivityDetail(activityId: number) {
  const [athlete, zonesData, activity] = await Promise.all([
    getAthleteCached(),
    getAthleteZonesCached(),
    getActivity(activityId),
  ]);

  const preference = athlete.measurement_preference;
  const heartRateZones = resolveHrZones(zonesData.heart_rate?.zones);
  const splits = (preference === 'feet' ? activity.splits_standard : activity.splits_metric) ?? [];
  const gearItems = [...athlete.bikes, ...athlete.shoes];
  const gear = activity.gear_id
    ? gearItems.find((item) => item.id === activity.gear_id)?.name ?? activity.gear_id
    : null;

  return {
    id: activity.id,
    name: activity.name,
    date: activity.start_date_local.slice(0, 10),
    sportType: activity.sport_type,
    distance: formatDistance(activity.distance, preference),
    movingTime: formatDuration(activity.moving_time),
    avgPace: formatPace(activity.average_speed, preference),
    avgHR: activity.average_heartrate ?? null,
    maxHR: activity.max_heartrate ?? null,
    elevationGain: formatDistance(activity.total_elevation_gain, preference),
    sufferScore: activity.suffer_score ?? null,
    calories: activity.calories ?? null,
    gear,
    hrZoneBreakdown: activity.average_heartrate != null
      ? `Avg HR ${activity.average_heartrate} bpm (${classifyHeartRate(activity.average_heartrate, heartRateZones)})`
      : null,
    mapPolyline: activity.map?.summary_polyline ?? null,
    splits: splits.map((split) => ({
      split: split.split,
      distance: formatDistance(split.distance, preference),
      movingTime: formatDuration(split.moving_time),
      pace: formatPace(split.average_speed, preference),
      avgHR: split.average_heartrate ?? null,
    })),
    bestEfforts: (activity.best_efforts ?? []).map((effort) => ({
      name: effort.name,
      time: formatDuration(effort.elapsed_time),
      prRank: effort.pr_rank ?? null,
    })),
    segmentEfforts: (activity.segment_efforts ?? []).map((effort) => ({
      name: effort.segment.name,
      time: formatDuration(effort.elapsed_time),
      distance: formatDistance(effort.segment.distance, preference),
      komRank: effort.kom_rank ?? null,
      prRank: effort.pr_rank ?? null,
    })),
  };
}

export function registerActivityTools(server: McpServer): void {
  server.tool(
    'get_recent_activities',
    'List recent Strava activities with distance, time, pace, heart rate, elevation, and suffer score.',
    {
      limit: z.number().int().min(1).max(30).default(10),
    },
    async ({ limit }) => {
      try {
        const activities = await buildRecentActivities(limit);
        if (activities.length === 0) {
          return { content: [{ type: 'text', text: 'No recent activities found.' }] };
        }

        return { content: [{ type: 'text', text: JSON.stringify(activities, null, 2) }] };
      } catch (error) {
        if (error instanceof StravaApiError) {
          return { content: [{ type: 'text', text: error.message }] };
        }

        throw error;
      }
    },
  );

  server.tool(
    'get_activity_detail',
    'Deep dive on a single Strava activity, including splits, best efforts, segment efforts, HR zone info, and map polyline.',
    {
      activity_id: z.number().int().positive(),
    },
    async ({ activity_id }) => {
      try {
        const detail = await buildActivityDetail(activity_id);
        return { content: [{ type: 'text', text: JSON.stringify(detail, null, 2) }] };
      } catch (error) {
        if (error instanceof StravaApiError) {
          return { content: [{ type: 'text', text: error.message }] };
        }

        throw error;
      }
    },
  );
}
