import { auth } from './auth.js';
import type {
  StravaAthlete, StravaAthleteStats, StravaSummaryActivity,
  StravaDetailedActivity, StravaAthleteZones, StravaStarredSegment, StravaGear,
} from './types.js';

const BASE = 'https://www.strava.com/api/v3';

export class StravaApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'StravaApiError';
  }
}

async function stravaFetch<T>(path: string): Promise<T> {
  const token = await auth.getAccessToken();
  const response = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 429) {
    const reset = response.headers.get('X-RateLimit-Reset');
    const minutes = reset
      ? Math.ceil((parseInt(reset, 10) * 1000 - Date.now()) / 60000)
      : 15;
    throw new StravaApiError(429, `Strava rate limit reached. Try again in ${minutes} minutes.`);
  }

  if (response.status === 401) {
    throw new StravaApiError(401, 'Strava authentication failed. Run `npm run setup` to re-authenticate.');
  }

  if (!response.ok) {
    throw new StravaApiError(response.status, `Strava API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getAthlete(): Promise<StravaAthlete> {
  return stravaFetch<StravaAthlete>('/athlete');
}

export async function getAthleteStats(id: number): Promise<StravaAthleteStats> {
  return stravaFetch<StravaAthleteStats>(`/athletes/${id}/stats`);
}

export async function getActivities(params: {
  after?: number;
  before?: number;
  per_page?: number;
  page?: number;
}): Promise<StravaSummaryActivity[]> {
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v != null)
      .map(([k, v]) => [k, String(v)])
  );
  return stravaFetch<StravaSummaryActivity[]>(`/athlete/activities?${qs}`);
}

export async function getActivity(id: number): Promise<StravaDetailedActivity> {
  return stravaFetch<StravaDetailedActivity>(`/activities/${id}`);
}

export async function getAthleteZones(): Promise<StravaAthleteZones> {
  return stravaFetch<StravaAthleteZones>('/athlete/zones');
}

export async function getStarredSegments(): Promise<StravaStarredSegment[]> {
  return stravaFetch<StravaStarredSegment[]>('/segments/starred');
}

export async function getGear(id: string): Promise<StravaGear> {
  return stravaFetch<StravaGear>(`/gear/${id}`);
}

// Lazy caches — populated on first call, reused for the process lifetime

let athleteCache: StravaAthlete | null = null;
export async function getAthleteCached(): Promise<StravaAthlete> {
  if (!athleteCache) athleteCache = await getAthlete();
  return athleteCache;
}

let zonesCache: StravaAthleteZones | null = null;
export async function getAthleteZonesCached(): Promise<StravaAthleteZones> {
  if (!zonesCache) zonesCache = await getAthleteZones();
  return zonesCache;
}

/** Reset module-level caches. Used in tests to prevent cache bleed between cases. */
export function resetCaches(): void {
  athleteCache = null;
  zonesCache = null;
}
