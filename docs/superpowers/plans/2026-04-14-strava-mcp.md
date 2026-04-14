# Strava MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript MCP server that gives Claude read-only access to a personal Strava account with 7 aggregated analysis tools.

**Architecture:** Stdio-based MCP server using `@modelcontextprotocol/sdk`. A shared `strava-client.ts` handles all HTTP calls and auto-refreshes tokens via `auth.ts`. Each tool lives in its own file and exports a `register*Tools(server)` function.

**Tech Stack:** TypeScript 5, Node 18+, `@modelcontextprotocol/sdk`, `zod`, `dotenv`, `vitest`, `tsx`

---

## File Map

| File | Responsibility |
|---|---|
| `package.json` | Project config, scripts, dependencies |
| `tsconfig.json` | TypeScript ESM config |
| `vitest.config.ts` | Test runner config |
| `.env.example` | Template for required env vars |
| `src/types.ts` | All Strava API TypeScript interfaces |
| `src/auth.ts` | In-memory token store, auto-refresh logic |
| `src/strava-client.ts` | Fetch wrapper: auth injection, error handling, pagination, lazy caches |
| `src/utils/dates.ts` | Date math helpers (week boundaries, unix timestamps, duration formatting) |
| `src/utils/zones.ts` | HR zone classification helpers |
| `src/tools/athlete.ts` | `get_athlete_profile` tool |
| `src/tools/training.ts` | `get_training_summary` and `get_fitness_trends` tools |
| `src/tools/activities.ts` | `get_recent_activities` and `get_activity_detail` tools |
| `src/tools/segments.ts` | `get_segment_efforts` tool |
| `src/tools/gear.ts` | `get_gear_summary` tool |
| `src/index.ts` | MCP server entry point, registers all tools |
| `scripts/setup-auth.ts` | One-time OAuth token fetcher |
| `tests/auth.test.ts` | Auth token refresh logic |
| `tests/strava-client.test.ts` | HTTP error handling (429, 401, network) |
| `tests/utils/dates.test.ts` | Date utility pure functions |
| `tests/utils/zones.test.ts` | Zone classification pure functions |
| `tests/tools/athlete.test.ts` | Athlete profile aggregation |
| `tests/tools/training.test.ts` | Weekly summary and fitness trends aggregation |
| `tests/tools/activities.test.ts` | Activity list and detail formatting |
| `tests/tools/segments.test.ts` | Segment data formatting |
| `tests/tools/gear.test.ts` | Gear list formatting |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "strava-mcp",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "setup": "tsx scripts/setup-auth.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.10.2",
    "dotenv": "^16.4.5",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.12.0",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0",
    "vitest": "^1.5.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
.env
*.js.map
```

- [ ] **Step 5: Create `.env.example`**

```
STRAVA_CLIENT_ID=your_client_id_here
STRAVA_CLIENT_SECRET=your_client_secret_here
STRAVA_REFRESH_TOKEN=your_refresh_token_here
```

- [ ] **Step 6: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created with no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore .env.example
git commit -m "chore: project scaffolding"
```

---

## Task 2: Type Definitions

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create `src/types.ts`**

```typescript
export interface StravaAthlete {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  city: string;
  country: string;
  profile: string;
  follower_count: number;
  friend_count: number;
  measurement_preference: 'feet' | 'meters';
  bikes: StravaGearSummary[];
  shoes: StravaGearSummary[];
}

export interface StravaGearSummary {
  id: string;
  name: string;
  primary: boolean;
  distance: number; // meters
  retired: boolean;
}

export interface StravaAthleteStats {
  recent_run_totals: StravaTotals;
  recent_ride_totals: StravaTotals;
  recent_swim_totals: StravaTotals;
  ytd_run_totals: StravaTotals;
  ytd_ride_totals: StravaTotals;
  ytd_swim_totals: StravaTotals;
  all_run_totals: StravaTotals;
  all_ride_totals: StravaTotals;
  all_swim_totals: StravaTotals;
}

export interface StravaTotals {
  count: number;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  elevation_gain: number; // meters
}

export interface StravaSummaryActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  total_elevation_gain: number; // meters
  average_speed: number; // m/s
  max_speed: number; // m/s
  average_heartrate?: number;
  max_heartrate?: number;
  suffer_score?: number;
  gear_id?: string;
  map?: { summary_polyline: string };
}

export interface StravaDetailedActivity extends StravaSummaryActivity {
  description?: string;
  calories?: number;
  device_name?: string;
  best_efforts?: StravaBestEffort[];
  segment_efforts?: StravaSegmentEffort[];
  splits_metric?: StravaSplit[];
  splits_standard?: StravaSplit[];
}

export interface StravaSplit {
  distance: number;
  elapsed_time: number;
  moving_time: number;
  average_speed: number; // m/s
  average_heartrate?: number;
  pace_zone?: number;
  split: number;
}

export interface StravaBestEffort {
  name: string;
  elapsed_time: number;
  distance: number;
  start_date_local: string;
  pr_rank?: number;
}

export interface StravaSegmentEffort {
  name: string;
  elapsed_time: number;
  start_date_local: string;
  distance: number;
  average_heartrate?: number;
  kom_rank?: number;
  pr_rank?: number;
  segment: {
    id: number;
    name: string;
    distance: number;
    average_grade: number;
  };
}

export interface StravaAthleteZones {
  heart_rate?: {
    custom_zones: boolean;
    zones: StravaHRZone[];
  };
}

export interface StravaHRZone {
  min: number;
  max: number; // -1 means no upper limit
}

export interface StravaStarredSegment {
  id: number;
  name: string;
  distance: number; // meters
  average_grade: number;
  athlete_segment_stats?: {
    pr_elapsed_time?: number;
    pr_date?: string;
    effort_count: number;
    last_effort_elapsed_time?: number;
  };
  xoms?: {
    kom?: string;
    qom?: string;
    overall?: string;
  };
}

export interface StravaGear {
  id: string;
  name: string;
  brand_name?: string;
  model_name?: string;
  distance: number; // meters
  retired: boolean;
  resource_state: number;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: Strava API type definitions"
```

---

## Task 3: Auth Module

**Files:**
- Create: `src/auth.ts`
- Create: `tests/auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must set env before importing module
process.env.STRAVA_CLIENT_ID = 'test_client_id';
process.env.STRAVA_CLIENT_SECRET = 'test_client_secret';
process.env.STRAVA_REFRESH_TOKEN = 'test_refresh_token';

const { StravaAuth } = await import('../src/auth.js');

describe('StravaAuth', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches a new token when none is cached', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new_access_token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const auth = new StravaAuth();
    const token = await auth.getAccessToken();

    expect(token).toBe('new_access_token');
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.strava.com/oauth/token',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('reuses cached token if not expiring within 5 minutes', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'cached_token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const auth = new StravaAuth();
    await auth.getAccessToken();
    await auth.getAccessToken();

    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('refreshes token when it expires within 5 minutes', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        access_token: `token_${++callCount}`,
        expires_at: Math.floor(Date.now() / 1000) + 200, // 3m20s — within 5m window
      }),
    }));
    vi.stubGlobal('fetch', mockFetch);

    const auth = new StravaAuth();
    const first = await auth.getAccessToken();
    const second = await auth.getAccessToken();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(first).toBe('token_1');
    expect(second).toBe('token_2');
  });

  it('throws when token refresh fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
    }));

    const auth = new StravaAuth();
    await expect(auth.getAccessToken()).rejects.toThrow('Token refresh failed: 400');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/auth.test.ts
```

Expected: FAIL — `src/auth.js` not found.

- [ ] **Step 3: Create `src/auth.ts`**

```typescript
interface TokenState {
  accessToken: string;
  expiresAt: number; // Unix seconds
}

export class StravaAuth {
  private state: TokenState | null = null;

  async getAccessToken(): Promise<string> {
    if (this.isValid()) return this.state!.accessToken;
    await this.refresh();
    return this.state!.accessToken;
  }

  private isValid(): boolean {
    if (!this.state) return false;
    // Treat as expired if within 5 minutes of actual expiry
    return Date.now() / 1000 < this.state.expiresAt - 300;
  }

  private async refresh(): Promise<void> {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        refresh_token: process.env.STRAVA_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json() as { access_token: string; expires_at: number };
    this.state = { accessToken: data.access_token, expiresAt: data.expires_at };
  }
}

export const auth = new StravaAuth();
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test tests/auth.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth.ts tests/auth.test.ts
git commit -m "feat: auth module with auto-refresh"
```

---

## Task 4: Strava API Client

**Files:**
- Create: `src/strava-client.ts`
- Create: `tests/strava-client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/strava-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.STRAVA_CLIENT_ID = 'test_client_id';
process.env.STRAVA_CLIENT_SECRET = 'test_client_secret';
process.env.STRAVA_REFRESH_TOKEN = 'test_refresh_token';

vi.mock('../src/auth.js', () => ({
  auth: { getAccessToken: vi.fn().mockResolvedValue('mock_token') },
}));

const { getAthlete, getAthleteStats, getActivities, getActivity,
        getAthleteZones, getStarredSegments, getGear,
        getAthleteCached, getAthleteZonesCached,
        StravaApiError } = await import('../src/strava-client.js');

describe('StravaApiError', () => {
  it('is an instance of Error with status', () => {
    const err = new StravaApiError(429, 'rate limited');
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(429);
    expect(err.message).toBe('rate limited');
  });
});

describe('strava-client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls the correct endpoint with Bearer token', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 1, firstname: 'Test' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await getAthlete();

    expect(result).toEqual({ id: 1, firstname: 'Test' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.strava.com/api/v3/athlete',
      expect.objectContaining({
        headers: { Authorization: 'Bearer mock_token' },
      })
    );
  });

  it('throws StravaApiError with minutes remaining on 429', async () => {
    const resetAt = Math.floor(Date.now() / 1000) + 900; // 15 minutes
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: (h: string) => h === 'X-RateLimit-Reset' ? String(resetAt) : null },
    }));

    await expect(getAthlete()).rejects.toThrow(StravaApiError);
    await expect(getAthlete()).rejects.toMatchObject({ status: 429 });
  });

  it('throws StravaApiError with auth message on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => null },
    }));

    const err = await getAthlete().catch(e => e);
    expect(err).toBeInstanceOf(StravaApiError);
    expect(err.status).toBe(401);
    expect(err.message).toContain('authentication failed');
  });

  it('builds activity query string correctly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });
    vi.stubGlobal('fetch', mockFetch);

    await getActivities({ after: 1000, per_page: 50, page: 2 });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('after=1000');
    expect(url).toContain('per_page=50');
    expect(url).toContain('page=2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/strava-client.test.ts
```

Expected: FAIL — `src/strava-client.js` not found.

- [ ] **Step 3: Create `src/strava-client.ts`**

```typescript
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
      ? Math.ceil((parseInt(reset) * 1000 - Date.now()) / 60000)
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test tests/strava-client.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/strava-client.ts tests/strava-client.test.ts
git commit -m "feat: Strava API client with error handling"
```

---

## Task 5: Date Utilities

**Files:**
- Create: `src/utils/dates.ts`
- Create: `tests/utils/dates.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/utils/dates.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  startOfWeek, weeksAgo, toUnixTimestamp,
  formatDuration, formatDistance, formatPace,
} from '../../src/utils/dates.js';

describe('startOfWeek', () => {
  it('returns Monday 00:00:00 for a Wednesday', () => {
    const wed = new Date('2024-04-10T15:30:00Z'); // Wednesday
    const result = startOfWeek(wed);
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it('returns the same Monday for a Monday', () => {
    const mon = new Date('2024-04-08T08:00:00Z'); // Monday
    const result = startOfWeek(mon);
    expect(result.getDay()).toBe(1);
  });
});

describe('toUnixTimestamp', () => {
  it('converts Date to integer unix seconds', () => {
    const d = new Date('2024-01-01T00:00:00Z');
    expect(toUnixTimestamp(d)).toBe(1704067200);
  });
});

describe('formatDuration', () => {
  it('formats seconds-only durations', () => {
    expect(formatDuration(45)).toBe('0m 45s');
  });

  it('formats minute durations', () => {
    expect(formatDuration(3661)).toBe('1h 1m');
  });

  it('formats sub-hour durations without hours', () => {
    expect(formatDuration(2700)).toBe('45m 0s');
  });
});

describe('formatDistance', () => {
  it('converts meters to km with 2 decimal places', () => {
    expect(formatDistance(10000, 'meters')).toBe('10.00 km');
  });

  it('converts meters to miles with 2 decimal places', () => {
    expect(formatDistance(10000, 'feet')).toBe('6.21 mi');
  });
});

describe('formatPace', () => {
  it('formats m/s as min/km for metric', () => {
    expect(formatPace(3.333, 'meters')).toBe('5:00 /km');
  });

  it('formats m/s as min/mile for imperial', () => {
    expect(formatPace(3.333, 'feet')).toBe('8:03 /mi');
  });

  it('returns -- for zero speed', () => {
    expect(formatPace(0, 'meters')).toBe('-- /km');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/utils/dates.test.ts
```

Expected: FAIL — `src/utils/dates.js` not found.

- [ ] **Step 3: Create `src/utils/dates.ts`**

```typescript
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function weeksAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d;
}

export function toUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

export function formatDistance(
  meters: number,
  preference: 'feet' | 'meters'
): string {
  if (preference === 'feet') {
    return `${(meters / 1609.344).toFixed(2)} mi`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatPace(
  mps: number,
  preference: 'feet' | 'meters'
): string {
  if (mps === 0) return preference === 'feet' ? '-- /mi' : '-- /km';

  if (preference === 'feet') {
    const secsPerMile = 1609.344 / mps;
    const min = Math.floor(secsPerMile / 60);
    const sec = Math.round(secsPerMile % 60);
    return `${min}:${sec.toString().padStart(2, '0')} /mi`;
  }

  const secsPerKm = 1000 / mps;
  const min = Math.floor(secsPerKm / 60);
  const sec = Math.round(secsPerKm % 60);
  return `${min}:${sec.toString().padStart(2, '0')} /km`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test tests/utils/dates.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/dates.ts tests/utils/dates.test.ts
git commit -m "feat: date and unit formatting utilities"
```

---

## Task 6: Zone Utilities

**Files:**
- Create: `src/utils/zones.ts`
- Create: `tests/utils/zones.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/utils/zones.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { classifyHeartRate, defaultZones, intensityLabel } from '../../src/utils/zones.js';
import type { StravaHRZone } from '../../src/types.js';

const zones: StravaHRZone[] = [
  { min: 0, max: 115 },   // Z1 easy
  { min: 115, max: 152 }, // Z2 easy
  { min: 152, max: 171 }, // Z3 moderate
  { min: 171, max: 190 }, // Z4 hard
  { min: 190, max: -1 },  // Z5 hard
];

describe('classifyHeartRate', () => {
  it('classifies Z1 as easy', () => {
    expect(classifyHeartRate(100, zones)).toBe('easy');
  });

  it('classifies Z2 as easy', () => {
    expect(classifyHeartRate(130, zones)).toBe('easy');
  });

  it('classifies Z3 as moderate', () => {
    expect(classifyHeartRate(160, zones)).toBe('moderate');
  });

  it('classifies Z4 as hard', () => {
    expect(classifyHeartRate(180, zones)).toBe('hard');
  });

  it('classifies Z5 (unbounded) as hard', () => {
    expect(classifyHeartRate(200, zones)).toBe('hard');
  });

  it('returns moderate when no zones provided', () => {
    expect(classifyHeartRate(150, [])).toBe('moderate');
  });
});

describe('defaultZones', () => {
  it('generates 5 zones based on max HR', () => {
    const z = defaultZones(200);
    expect(z).toHaveLength(5);
    expect(z[0].min).toBe(0);
    expect(z[4].max).toBe(-1);
  });
});

describe('intensityLabel', () => {
  it('formats distribution percentages', () => {
    expect(intensityLabel({ easy: 0.6, moderate: 0.3, hard: 0.1 }))
      .toBe('60% easy / 30% moderate / 10% hard');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/utils/zones.test.ts
```

Expected: FAIL — `src/utils/zones.js` not found.

- [ ] **Step 3: Create `src/utils/zones.ts`**

```typescript
import type { StravaHRZone } from '../types.js';

export type IntensityBucket = 'easy' | 'moderate' | 'hard';

export interface IntensityDistribution {
  easy: number;   // 0–1
  moderate: number;
  hard: number;
}

export function classifyHeartRate(hr: number, zones: StravaHRZone[]): IntensityBucket {
  if (zones.length === 0) return 'moderate';

  const zoneIndex = zones.findIndex(
    z => hr >= z.min && (z.max === -1 || hr < z.max)
  );

  if (zoneIndex <= 1) return 'easy';
  if (zoneIndex === 2) return 'moderate';
  return 'hard';
}

export function defaultZones(maxHr: number = 190): StravaHRZone[] {
  return [
    { min: 0,                          max: Math.round(maxHr * 0.60) },
    { min: Math.round(maxHr * 0.60),   max: Math.round(maxHr * 0.70) },
    { min: Math.round(maxHr * 0.70),   max: Math.round(maxHr * 0.80) },
    { min: Math.round(maxHr * 0.80),   max: Math.round(maxHr * 0.90) },
    { min: Math.round(maxHr * 0.90),   max: -1 },
  ];
}

export function intensityLabel(dist: IntensityDistribution): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return `${pct(dist.easy)} easy / ${pct(dist.moderate)} moderate / ${pct(dist.hard)} hard`;
}

export function computeIntensityDistribution(
  heartRates: number[],
  zones: StravaHRZone[]
): IntensityDistribution {
  if (heartRates.length === 0) return { easy: 0, moderate: 0, hard: 0 };

  let easy = 0, moderate = 0, hard = 0;
  for (const hr of heartRates) {
    const bucket = classifyHeartRate(hr, zones);
    if (bucket === 'easy') easy++;
    else if (bucket === 'moderate') moderate++;
    else hard++;
  }

  const total = heartRates.length;
  return { easy: easy / total, moderate: moderate / total, hard: hard / total };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test tests/utils/zones.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/zones.ts tests/utils/zones.test.ts
git commit -m "feat: HR zone classification utilities"
```

---

## Task 7: Athlete Tool

**Files:**
- Create: `src/tools/athlete.ts`
- Create: `tests/tools/athlete.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/tools/athlete.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/tools/athlete.test.ts
```

Expected: FAIL — `src/tools/athlete.js` not found.

- [ ] **Step 3: Create `src/tools/athlete.ts`**

```typescript
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
  const pref = athlete.measurement_preference;

  return {
    name: `${athlete.firstname} ${athlete.lastname}`,
    username: athlete.username,
    location: [athlete.city, athlete.country].filter(Boolean).join(', '),
    profile: athlete.profile,
    followers: athlete.follower_count,
    following: athlete.friend_count,
    recentRuns: formatTotals(stats.recent_run_totals, pref),
    recentRides: formatTotals(stats.recent_ride_totals, pref),
    recentSwims: formatTotals(stats.recent_swim_totals, pref),
    ytd: {
      runs: formatTotals(stats.ytd_run_totals, pref),
      rides: formatTotals(stats.ytd_ride_totals, pref),
      swims: formatTotals(stats.ytd_swim_totals, pref),
    },
    allTime: {
      runs: formatTotals(stats.all_run_totals, pref),
      rides: formatTotals(stats.all_ride_totals, pref),
      swims: formatTotals(stats.all_swim_totals, pref),
    },
  };
}

export function registerAthleteTools(server: McpServer): void {
  server.tool(
    'get_athlete_profile',
    'Get Strava athlete profile with all-time stats, year-to-date totals, and recent 4-week totals for runs, rides, and swims.',
    {},
    async () => {
      try {
        const profile = await buildAthleteProfile();
        return { content: [{ type: 'text', text: JSON.stringify(profile, null, 2) }] };
      } catch (err) {
        if (err instanceof StravaApiError) {
          return { content: [{ type: 'text', text: err.message }] };
        }
        throw err;
      }
    }
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test tests/tools/athlete.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/athlete.ts tests/tools/athlete.test.ts
git commit -m "feat: get_athlete_profile tool"
```

---

## Task 8: Training Summary Tool

**Files:**
- Create: `src/tools/training.ts`
- Create: `tests/tools/training.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/tools/training.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StravaSummaryActivity, StravaAthleteZones } from '../../src/types.js';

vi.mock('../../src/strava-client.js', () => ({
  getActivities: vi.fn(),
  getAthleteCached: vi.fn(),
  getAthleteZonesCached: vi.fn(),
  StravaApiError: class StravaApiError extends Error {
    constructor(public status: number, message: string) { super(message); }
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
    max_speed: 4.0,
    average_heartrate: 145,
    ...overrides,
  };
}

describe('buildTrainingSummary', () => {
  beforeEach(() => {
    vi.mocked(client.getAthleteCached).mockResolvedValue({
      id: 1, username: 'test', firstname: 'T', lastname: 'T',
      city: '', country: '', profile: '', follower_count: 0, friend_count: 0,
      measurement_preference: 'meters', bikes: [], shoes: [],
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
    // Monday April 8, 2024
    const activity = makeActivity({ start_date: '2024-04-08T07:00:00Z', distance: 10000 });
    vi.mocked(client.getActivities).mockResolvedValue([activity]);

    const result = await buildTrainingSummary({ weeks: 4, sportType: 'all' });
    const week = result.weeks.find(w => w.weekStart.startsWith('2024-04-08'));
    expect(week).toBeDefined();
    expect(week!.activityCount).toBe(1);
    expect(week!.totalDistance).toBe('10.00 km');
  });

  it('filters by sport type', async () => {
    const run = makeActivity({ sport_type: 'Run' });
    const ride = makeActivity({ id: 2, sport_type: 'Ride', start_date: '2024-04-08T09:00:00Z' });
    vi.mocked(client.getActivities).mockResolvedValue([run, ride]);

    const result = await buildTrainingSummary({ weeks: 4, sportType: 'run' });
    const week = result.weeks.find(w => w.activityCount > 0);
    expect(week!.activityCount).toBe(1);
  });

  it('computes intensity distribution from HR', async () => {
    const activity = makeActivity({ average_heartrate: 130 }); // Z2 = easy
    vi.mocked(client.getActivities).mockResolvedValue([activity]);

    const result = await buildTrainingSummary({ weeks: 4, sportType: 'all' });
    const week = result.weeks.find(w => w.activityCount > 0)!;
    expect(week.intensity.easy).toBeGreaterThan(0);
    expect(week.intensity.hard).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/tools/training.test.ts
```

Expected: FAIL — `src/tools/training.js` not found.

- [ ] **Step 3: Create `src/tools/training.ts`**

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  getActivities, getAthleteCached, getAthleteZonesCached, StravaApiError,
} from '../strava-client.js';
import { startOfWeek, weeksAgo, toUnixTimestamp, formatDistance, formatDuration, formatPace } from '../utils/dates.js';
import { classifyHeartRate, defaultZones, intensityLabel } from '../utils/zones.js';
import type { StravaSummaryActivity, StravaHRZone } from '../types.js';

async function fetchActivitiesInRange(after: Date, before: Date): Promise<StravaSummaryActivity[]> {
  const all: StravaSummaryActivity[] = [];
  let page = 1;
  while (true) {
    const batch = await getActivities({
      after: toUnixTimestamp(after),
      before: toUnixTimestamp(before),
      per_page: 200,
      page,
    });
    all.push(...batch);
    if (batch.length < 200) break;
    page++;
  }
  return all;
}

function getHRZones(zones: StravaHRZone[] | undefined): StravaHRZone[] {
  return zones && zones.length > 0 ? zones : defaultZones();
}

export async function buildTrainingSummary(params: { weeks: number; sportType: string }) {
  const { weeks, sportType } = params;
  const athlete = await getAthleteCached();
  const zonesData = await getAthleteZonesCached();
  const hrZones = getHRZones(zonesData.heart_rate?.zones);
  const pref = athlete.measurement_preference;

  const before = new Date();
  const after = weeksAgo(weeks);
  const activities = await fetchActivitiesInRange(after, before);

  const filtered = sportType === 'all'
    ? activities
    : activities.filter(a => a.sport_type.toLowerCase() === sportType.toLowerCase());

  if (filtered.length === 0) {
    return { weeks: [], message: `No activities found in the last ${weeks} weeks.` };
  }

  // Build week buckets
  const weekMap = new Map<string, StravaSummaryActivity[]>();
  for (const activity of filtered) {
    const weekStart = startOfWeek(new Date(activity.start_date));
    const key = weekStart.toISOString().slice(0, 10);
    if (!weekMap.has(key)) weekMap.set(key, []);
    weekMap.get(key)!.push(activity);
  }

  const weekRows = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, acts]) => {
      const totalDistance = acts.reduce((s, a) => s + a.distance, 0);
      const totalTime = acts.reduce((s, a) => s + a.moving_time, 0);
      const totalElevation = acts.reduce((s, a) => s + a.total_elevation_gain, 0);
      const hrActivities = acts.filter(a => a.average_heartrate != null);
      const avgHR = hrActivities.length > 0
        ? Math.round(hrActivities.reduce((s, a) => s + a.average_heartrate!, 0) / hrActivities.length)
        : null;
      const avgSpeed = totalTime > 0 ? totalDistance / totalTime : 0;

      // Intensity: classify each HR-tracked activity
      const hrValues = hrActivities.map(a => a.average_heartrate!);
      let easy = 0, moderate = 0, hard = 0;
      for (const hr of hrValues) {
        const b = classifyHeartRate(hr, hrZones);
        if (b === 'easy') easy++;
        else if (b === 'moderate') moderate++;
        else hard++;
      }
      const total = hrValues.length || 1;
      const intensity = { easy: easy / total, moderate: moderate / total, hard: hard / total };

      // Count days with no activity in the week
      const activityDays = new Set(acts.map(a => new Date(a.start_date).toISOString().slice(0, 10)));
      const restDays = 7 - activityDays.size;

      return {
        weekStart,
        activityCount: acts.length,
        totalDistance: formatDistance(totalDistance, pref),
        totalTime: formatDuration(totalTime),
        totalElevation: formatDistance(totalElevation, pref),
        avgPace: formatPace(avgSpeed, pref),
        avgHR: avgHR ?? 'n/a',
        intensity,
        intensitySummary: hrValues.length > 0 ? intensityLabel(intensity) : 'no HR data',
        restDays,
      };
    });

  return { weeks: weekRows, message: null };
}

export async function buildFitnessTrends(params: { weeks: number }) {
  const { weeks } = params;
  const athlete = await getAthleteCached();
  const pref = athlete.measurement_preference;

  const before = new Date();
  const after = weeksAgo(weeks);
  const activities = await fetchActivitiesInRange(after, before);

  if (activities.length === 0) {
    return { message: `No activities found in the last ${weeks} weeks.`, weeks: [] };
  }

  // Build week buckets
  const weekMap = new Map<string, StravaSummaryActivity[]>();
  for (const activity of activities) {
    const weekStart = startOfWeek(new Date(activity.start_date));
    const key = weekStart.toISOString().slice(0, 10);
    if (!weekMap.has(key)) weekMap.set(key, []);
    weekMap.get(key)!.push(activity);
  }

  const weekRows = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, acts]) => ({
      weekStart,
      totalDistance: acts.reduce((s, a) => s + a.distance, 0),
      totalDistanceFormatted: formatDistance(acts.reduce((s, a) => s + a.distance, 0), pref),
      totalTime: acts.reduce((s, a) => s + a.moving_time, 0),
      activityCount: acts.length,
      sportBreakdown: acts.reduce((acc, a) => {
        acc[a.sport_type] = (acc[a.sport_type] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    }));

  // 4-week rolling average
  const withRolling = weekRows.map((w, i) => {
    const window = weekRows.slice(Math.max(0, i - 3), i + 1);
    const avg = window.reduce((s, x) => s + x.totalDistance, 0) / window.length;
    return { ...w, rollingAvgDistance: formatDistance(avg, pref) };
  });

  // Trend direction: compare last 4 weeks vs prior 4 weeks
  const last4 = weekRows.slice(-4).reduce((s, w) => s + w.totalDistance, 0);
  const prior4 = weekRows.slice(-8, -4).reduce((s, w) => s + w.totalDistance, 0);
  let trend: string;
  if (prior4 === 0) trend = 'insufficient data';
  else if (last4 > prior4 * 1.05) trend = 'increasing';
  else if (last4 < prior4 * 0.95) trend = 'decreasing';
  else trend = 'stable';

  // Longest streak
  const allDays = activities.map(a => a.start_date.slice(0, 10)).sort();
  let longestStreak = 1, currentStreak = 1;
  for (let i = 1; i < allDays.length; i++) {
    const prev = new Date(allDays[i - 1]);
    const curr = new Date(allDays[i]);
    const diff = (curr.getTime() - prev.getTime()) / 86400000;
    if (diff === 1) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else if (diff > 1) {
      currentStreak = 1;
    }
  }

  const biggestWeek = weekRows.reduce((best, w) =>
    w.totalDistance > best.totalDistance ? w : best, weekRows[0]);

  return {
    weeks: withRolling,
    trend,
    longestStreakDays: longestStreak,
    biggestWeek: {
      weekStart: biggestWeek.weekStart,
      distance: formatDistance(biggestWeek.totalDistance, pref),
    },
    message: null,
  };
}

export function registerTrainingTools(server: McpServer): void {
  server.tool(
    'get_training_summary',
    'Pre-aggregated weekly training breakdown. Returns per-week distance, time, elevation, avg pace, avg HR, intensity distribution, and rest days.',
    {
      weeks: z.number().int().min(1).max(52).default(4).describe('Number of weeks to look back (1–52)'),
      sport_type: z.enum(['run', 'ride', 'swim', 'all']).default('all').describe('Filter by sport type'),
    },
    async ({ weeks, sport_type }) => {
      try {
        const result = await buildTrainingSummary({ weeks, sportType: sport_type });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        if (err instanceof StravaApiError) {
          return { content: [{ type: 'text', text: err.message }] };
        }
        throw err;
      }
    }
  );

  server.tool(
    'get_fitness_trends',
    'Longer-term training trend analysis. Returns rolling weekly volume, trend direction (increasing/stable/decreasing), longest active streak, and biggest volume week.',
    {
      weeks: z.number().int().min(4).max(52).default(12).describe('Number of weeks to analyse (4–52)'),
    },
    async ({ weeks }) => {
      try {
        const result = await buildFitnessTrends({ weeks });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        if (err instanceof StravaApiError) {
          return { content: [{ type: 'text', text: err.message }] };
        }
        throw err;
      }
    }
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test tests/tools/training.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/training.ts tests/tools/training.test.ts
git commit -m "feat: get_training_summary and get_fitness_trends tools"
```

---

## Task 9: Activities Tools

**Files:**
- Create: `src/tools/activities.ts`
- Create: `tests/tools/activities.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/tools/activities.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StravaSummaryActivity, StravaDetailedActivity } from '../../src/types.js';

vi.mock('../../src/strava-client.js', () => ({
  getActivities: vi.fn(),
  getActivity: vi.fn(),
  getAthleteCached: vi.fn(),
  getAthleteZonesCached: vi.fn(),
  StravaApiError: class StravaApiError extends Error {
    constructor(public status: number, message: string) { super(message); }
  },
}));

const client = await import('../../src/strava-client.js');
const { buildRecentActivities, buildActivityDetail } = await import('../../src/tools/activities.js');

const mockAthlete = {
  id: 1, username: 't', firstname: 'T', lastname: 'T',
  city: '', country: '', profile: '', follower_count: 0, friend_count: 0,
  measurement_preference: 'meters' as const, bikes: [], shoes: [],
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
  max_speed: 4.0,
  average_heartrate: 145,
  suffer_score: 80,
};

describe('buildRecentActivities', () => {
  beforeEach(() => {
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/tools/activities.test.ts
```

Expected: FAIL — `src/tools/activities.js` not found.

- [ ] **Step 3: Create `src/tools/activities.ts`**

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  getActivities, getActivity, getAthleteCached, getAthleteZonesCached, StravaApiError,
} from '../strava-client.js';
import { formatDistance, formatDuration, formatPace } from '../utils/dates.js';
import { classifyHeartRate, defaultZones, computeIntensityDistribution, intensityLabel } from '../utils/zones.js';
import type { StravaHRZone } from '../types.js';

function getHRZones(zones: StravaHRZone[] | undefined): StravaHRZone[] {
  return zones && zones.length > 0 ? zones : defaultZones();
}

export async function buildRecentActivities(limit: number) {
  const athlete = await getAthleteCached();
  const pref = athlete.measurement_preference;
  const activities = await getActivities({ per_page: limit, page: 1 });

  return activities.map(a => ({
    id: a.id,
    name: a.name,
    date: a.start_date_local.slice(0, 10),
    sportType: a.sport_type,
    distance: formatDistance(a.distance, pref),
    movingTime: formatDuration(a.moving_time),
    avgPace: formatPace(a.average_speed, pref),
    avgHR: a.average_heartrate ?? null,
    elevationGain: formatDistance(a.total_elevation_gain, pref),
    sufferScore: a.suffer_score ?? null,
  }));
}

export async function buildActivityDetail(activityId: number) {
  const [athlete, zonesData, activity] = await Promise.all([
    getAthleteCached(),
    getAthleteZonesCached(),
    getActivity(activityId),
  ]);

  const pref = athlete.measurement_preference;
  const hrZones = getHRZones(zonesData.heart_rate?.zones);

  const splits = (pref === 'feet' ? activity.splits_standard : activity.splits_metric) ?? [];

  const formattedSplits = splits.map(s => ({
    split: s.split,
    distance: formatDistance(s.distance, pref),
    movingTime: formatDuration(s.moving_time),
    pace: formatPace(s.average_speed, pref),
    avgHR: s.average_heartrate ?? null,
  }));

  const bestEfforts = (activity.best_efforts ?? []).map(e => ({
    name: e.name,
    time: formatDuration(e.elapsed_time),
    prRank: e.pr_rank ?? null,
  }));

  const segmentEfforts = (activity.segment_efforts ?? []).map(e => ({
    name: e.segment.name,
    time: formatDuration(e.elapsed_time),
    distance: formatDistance(e.segment.distance, pref),
    komRank: e.kom_rank ?? null,
    prRank: e.pr_rank ?? null,
  }));

  // HR zone breakdown if HR data available
  let hrZoneBreakdown: string | null = null;
  if (activity.average_heartrate) {
    // Use avg HR as a proxy (detailed zone breakdown requires streams API)
    const bucket = classifyHeartRate(activity.average_heartrate, hrZones);
    hrZoneBreakdown = `Avg HR ${activity.average_heartrate} bpm (${bucket})`;
  }

  // Resolve gear name from athlete's gear list (no extra API call)
  const allGear = [...athlete.bikes, ...athlete.shoes];
  const gear = activity.gear_id
    ? allGear.find(g => g.id === activity.gear_id)?.name ?? activity.gear_id
    : null;

  return {
    id: activity.id,
    name: activity.name,
    date: activity.start_date_local.slice(0, 10),
    sportType: activity.sport_type,
    distance: formatDistance(activity.distance, pref),
    movingTime: formatDuration(activity.moving_time),
    avgPace: formatPace(activity.average_speed, pref),
    avgHR: activity.average_heartrate ?? null,
    maxHR: activity.max_heartrate ?? null,
    elevationGain: formatDistance(activity.total_elevation_gain, pref),
    sufferScore: activity.suffer_score ?? null,
    calories: activity.calories ?? null,
    gear,
    hrZoneBreakdown,
    mapPolyline: activity.map?.summary_polyline ?? null,
    splits: formattedSplits,
    bestEfforts,
    segmentEfforts,
  };
}

export function registerActivityTools(server: McpServer): void {
  server.tool(
    'get_recent_activities',
    'List recent Strava activities with key stats: distance, time, pace, HR, elevation, suffer score.',
    {
      limit: z.number().int().min(1).max(30).default(10).describe('Number of recent activities to return (1–30)'),
    },
    async ({ limit }) => {
      try {
        const activities = await buildRecentActivities(limit);
        if (activities.length === 0) {
          return { content: [{ type: 'text', text: 'No recent activities found.' }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify(activities, null, 2) }] };
      } catch (err) {
        if (err instanceof StravaApiError) {
          return { content: [{ type: 'text', text: err.message }] };
        }
        throw err;
      }
    }
  );

  server.tool(
    'get_activity_detail',
    'Deep dive on a single Strava activity. Returns splits, best efforts, segment efforts, HR zone info, and map polyline.',
    {
      activity_id: z.number().int().positive().describe('Strava activity ID (visible in the activity URL)'),
    },
    async ({ activity_id }) => {
      try {
        const detail = await buildActivityDetail(activity_id);
        return { content: [{ type: 'text', text: JSON.stringify(detail, null, 2) }] };
      } catch (err) {
        if (err instanceof StravaApiError) {
          return { content: [{ type: 'text', text: err.message }] };
        }
        throw err;
      }
    }
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test tests/tools/activities.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/activities.ts tests/tools/activities.test.ts
git commit -m "feat: get_recent_activities and get_activity_detail tools"
```

---

## Task 10: Segments Tool

**Files:**
- Create: `src/tools/segments.ts`
- Create: `tests/tools/segments.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/tools/segments.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StravaStarredSegment } from '../../src/types.js';

vi.mock('../../src/strava-client.js', () => ({
  getStarredSegments: vi.fn(),
  getAthleteCached: vi.fn(),
  StravaApiError: class StravaApiError extends Error {
    constructor(public status: number, message: string) { super(message); }
  },
}));

const client = await import('../../src/strava-client.js');
const { buildSegmentEfforts } = await import('../../src/tools/segments.js');

const mockAthlete = {
  id: 1, username: 't', firstname: 'T', lastname: 'T',
  city: '', country: '', profile: '', follower_count: 0, friend_count: 0,
  measurement_preference: 'meters' as const, bikes: [], shoes: [],
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
    expect(result.segments[0].name).toBe("Alpe d'Huez");
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/tools/segments.test.ts
```

Expected: FAIL — `src/tools/segments.js` not found.

- [ ] **Step 3: Create `src/tools/segments.ts`**

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getStarredSegments, getAthleteCached, StravaApiError } from '../strava-client.js';
import { formatDistance, formatDuration } from '../utils/dates.js';

export async function buildSegmentEfforts() {
  const [athlete, segments] = await Promise.all([
    getAthleteCached(),
    getStarredSegments(),
  ]);

  if (segments.length === 0) {
    return { segments: [], message: 'No starred segments found. Star segments on Strava to track them here.' };
  }

  const pref = athlete.measurement_preference;

  const formatted = segments.slice(0, 20).map(s => ({
    id: s.id,
    name: s.name,
    distance: formatDistance(s.distance, pref),
    avgGrade: `${s.average_grade}%`,
    effortCount: s.athlete_segment_stats?.effort_count ?? 0,
    prTime: s.athlete_segment_stats?.pr_elapsed_time
      ? formatDuration(s.athlete_segment_stats.pr_elapsed_time)
      : null,
    prDate: s.athlete_segment_stats?.pr_date ?? null,
    kom: s.xoms?.kom ?? null,
    qom: s.xoms?.qom ?? null,
  }));

  return { segments: formatted, message: null };
}

export function registerSegmentTools(server: McpServer): void {
  server.tool(
    'get_segment_efforts',
    'Lists your starred Strava segments with PR times, effort counts, and KOM/QOM benchmarks.',
    {},
    async () => {
      try {
        const result = await buildSegmentEfforts();
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        if (err instanceof StravaApiError) {
          return { content: [{ type: 'text', text: err.message }] };
        }
        throw err;
      }
    }
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test tests/tools/segments.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/segments.ts tests/tools/segments.test.ts
git commit -m "feat: get_segment_efforts tool"
```

---

## Task 11: Gear Tool

**Files:**
- Create: `src/tools/gear.ts`
- Create: `tests/tools/gear.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/tools/gear.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StravaGear } from '../../src/types.js';

vi.mock('../../src/strava-client.js', () => ({
  getAthleteCached: vi.fn(),
  getGear: vi.fn(),
  StravaApiError: class StravaApiError extends Error {
    constructor(public status: number, message: string) { super(message); }
  },
}));

const client = await import('../../src/strava-client.js');
const { buildGearSummary } = await import('../../src/tools/gear.js');

const mockGear: StravaGear = {
  id: 'g1',
  name: 'Nike Pegasus 41',
  brand_name: 'Nike',
  model_name: 'Pegasus 41',
  distance: 500000, // 500km in meters
  retired: false,
  resource_state: 3,
};

describe('buildGearSummary', () => {
  beforeEach(() => {
    vi.mocked(client.getAthleteCached).mockResolvedValue({
      id: 1, username: 't', firstname: 'T', lastname: 'T',
      city: '', country: '', profile: '', follower_count: 0, friend_count: 0,
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
      id: 1, username: 't', firstname: 'T', lastname: 'T',
      city: '', country: '', profile: '', follower_count: 0, friend_count: 0,
      measurement_preference: 'meters' as const,
      bikes: [], shoes: [],
    });
    const result = await buildGearSummary();
    expect(result.bikes).toHaveLength(0);
    expect(result.shoes).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/tools/gear.test.ts
```

Expected: FAIL — `src/tools/gear.js` not found.

- [ ] **Step 3: Create `src/tools/gear.ts`**

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAthleteCached, getGear, StravaApiError } from '../strava-client.js';
import { formatDistance } from '../utils/dates.js';
import type { StravaGear, StravaGearSummary } from '../types.js';

async function formatGearItem(
  summary: StravaGearSummary,
  pref: 'feet' | 'meters'
) {
  const detail: StravaGear = await getGear(summary.id);
  return {
    id: summary.id,
    name: detail.name,
    brand: detail.brand_name ?? null,
    model: detail.model_name ?? null,
    distance: formatDistance(detail.distance, pref),
    primary: summary.primary,
    retired: detail.retired,
  };
}

export async function buildGearSummary() {
  const athlete = await getAthleteCached();
  const pref = athlete.measurement_preference;

  const [bikes, shoes] = await Promise.all([
    Promise.all(athlete.bikes.map(g => formatGearItem(g, pref))),
    Promise.all(athlete.shoes.map(g => formatGearItem(g, pref))),
  ]);

  return { bikes, shoes };
}

export function registerGearTools(server: McpServer): void {
  server.tool(
    'get_gear_summary',
    'Lists all your Strava bikes and shoes with mileage, brand, model, and retired status.',
    {},
    async () => {
      try {
        const result = await buildGearSummary();
        if (result.bikes.length === 0 && result.shoes.length === 0) {
          return { content: [{ type: 'text', text: 'No gear found on your Strava account.' }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        if (err instanceof StravaApiError) {
          return { content: [{ type: 'text', text: err.message }] };
        }
        throw err;
      }
    }
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test tests/tools/gear.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/gear.ts tests/tools/gear.test.ts
git commit -m "feat: get_gear_summary tool"
```

---

## Task 12: MCP Server Entry Point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create `src/index.ts`**

```typescript
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAthleteTools } from './tools/athlete.js';
import { registerTrainingTools } from './tools/training.js';
import { registerActivityTools } from './tools/activities.js';
import { registerSegmentTools } from './tools/segments.js';
import { registerGearTools } from './tools/gear.js';

const server = new McpServer({
  name: 'strava-mcp',
  version: '1.0.0',
});

registerAthleteTools(server);
registerTrainingTools(server);
registerActivityTools(server);
registerSegmentTools(server);
registerGearTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: MCP server entry point"
```

---

## Task 13: OAuth Setup Script

**Files:**
- Create: `scripts/setup-auth.ts`

- [ ] **Step 1: Create `scripts/setup-auth.ts`**

```typescript
import 'dotenv/config';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { exec } from 'child_process';

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    'Error: STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set.\n' +
    'Copy .env.example to .env and fill in your app credentials from https://www.strava.com/settings/api'
  );
  process.exit(1);
}

const REDIRECT_URI = 'http://localhost:8080/callback';
const authUrl =
  `https://www.strava.com/oauth/authorize` +
  `?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&approval_prompt=force` +
  `&scope=read,activity:read_all`;

console.log('\nOpening Strava authorization page...');
console.log('If the browser does not open, visit:\n', authUrl, '\n');

// Open browser cross-platform
const openCmd =
  process.platform === 'darwin' ? `open "${authUrl}"` :
  process.platform === 'win32' ? `start "${authUrl}"` :
  `xdg-open "${authUrl}"`;
exec(openCmd);

// Wait for OAuth callback
const code = await new Promise<string>((resolve, reject) => {
  const server = createServer((req, res) => {
    if (!req.url?.startsWith('/callback')) {
      res.writeHead(404);
      res.end();
      return;
    }

    const url = new URL(req.url, 'http://localhost:8080');
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<h1>Error: ${error}</h1><p>You can close this tab.</p>`);
      server.close();
      reject(new Error(`Strava authorization denied: ${error}`));
      return;
    }

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h1>Error: no code received</h1>');
      server.close();
      reject(new Error('No authorization code in callback'));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Authorization successful!</h1><p>You can close this tab and return to the terminal.</p>');
    server.close();
    resolve(code);
  });

  server.listen(8080, () => {
    console.log('Waiting for Strava callback on http://localhost:8080/callback...');
  });

  server.on('error', reject);
});

// Exchange code for tokens
console.log('\nExchanging code for tokens...');
const response = await fetch('https://www.strava.com/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
  }),
});

if (!response.ok) {
  const body = await response.text();
  console.error('Token exchange failed:', response.status, body);
  process.exit(1);
}

const tokens = await response.json() as {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: { firstname: string; lastname: string };
};

// Write to .env (preserves existing CLIENT_ID / CLIENT_SECRET lines)
const envContent = [
  `STRAVA_CLIENT_ID=${CLIENT_ID}`,
  `STRAVA_CLIENT_SECRET=${CLIENT_SECRET}`,
  `STRAVA_REFRESH_TOKEN=${tokens.refresh_token}`,
].join('\n') + '\n';

writeFileSync('.env', envContent);

console.log(`\nAuthenticated as: ${tokens.athlete.firstname} ${tokens.athlete.lastname}`);
console.log('Tokens saved to .env');
console.log('\nYou can now start the MCP server with: npm run dev');
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. (The scripts directory is excluded from `tsconfig.json`'s `include`, so run with `tsx` which handles it directly.)

- [ ] **Step 3: Commit**

```bash
git add scripts/setup-auth.ts
git commit -m "feat: OAuth setup script"
```

---

## Task 14: Build and Claude Desktop Integration

**Files:**
- Create: `README.md`

- [ ] **Step 1: Verify production build succeeds**

```bash
npm run build
```

Expected: `dist/` directory created with `dist/index.js`.

- [ ] **Step 2: Create `README.md`**

```markdown
# strava-mcp

A personal Strava MCP server for Claude. Read-only access to your training data with 7 analysis tools.

## Setup

### 1. Create a Strava API application

Go to https://www.strava.com/settings/api and create an app.
Set the **Authorization Callback Domain** to `localhost`.

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and add your STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET
```

### 3. Authenticate

```bash
npm install
npm run setup
```

This opens a browser to authorize your Strava account and saves your refresh token to `.env`.

### 4. Add to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "strava": {
      "command": "node",
      "args": ["/absolute/path/to/strava-mcp/dist/index.js"],
      "env": {
        "STRAVA_CLIENT_ID": "your_id",
        "STRAVA_CLIENT_SECRET": "your_secret",
        "STRAVA_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

Then restart Claude Desktop.

## Tools

| Tool | Description |
|---|---|
| `get_athlete_profile` | All-time stats, YTD totals, follower counts |
| `get_training_summary` | Weekly breakdown: volume, pace, HR, intensity |
| `get_fitness_trends` | Rolling trends, streak, biggest week |
| `get_recent_activities` | Last N activities with key stats |
| `get_activity_detail` | Deep dive: splits, best efforts, segments |
| `get_segment_efforts` | Starred segments with PR times and KOM benchmarks |
| `get_gear_summary` | Bikes and shoes with mileage |

## Development

```bash
npm run dev      # run with tsx (no build step)
npm test         # run all tests
npm run build    # compile to dist/
```
```

- [ ] **Step 3: Run the full test suite one final time**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add dist/ README.md
git commit -m "feat: production build and setup docs"
```

- [ ] **Step 5: Push**

```bash
git push
```
