# Strava MCP Design

**Date:** 2026-04-14  
**Status:** Approved

## Overview

A TypeScript MCP server that connects Claude to a personal Strava account for training dashboard and coaching/analysis use cases. Read-only access. Pre-authenticated via a one-time OAuth setup script; access tokens refresh automatically at runtime.

---

## Architecture

```
strava-mcp/
├── src/
│   ├── index.ts          # MCP server entry point, registers all tools
│   ├── auth.ts           # Token manager: stores access token in memory, auto-refreshes
│   ├── strava-client.ts  # Raw Strava API wrapper (fetch-based, injects auth header)
│   ├── tools/            # One file per MCP tool
│   │   ├── athlete.ts    # get_athlete_profile
│   │   ├── training.ts   # get_training_summary, get_fitness_trends
│   │   ├── activities.ts # get_recent_activities, get_activity_detail
│   │   ├── segments.ts   # get_segment_efforts
│   │   └── gear.ts       # get_gear_summary
│   └── utils/
│       ├── dates.ts      # Date/range helpers
│       └── zones.ts      # HR zone calculations (fetched from GET /athlete/zones on startup)
├── scripts/
│   └── setup-auth.ts     # One-time OAuth token fetcher
├── .env                  # STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN
└── package.json
```

**Data flow:** Claude calls an MCP tool → tool calls `strava-client.ts` (which auto-refreshes the token if needed) → raw API data is aggregated/computed → structured result returned to Claude.

---

## Authentication

### One-time setup (`npm run setup`)

1. Opens `https://www.strava.com/oauth/authorize` in the browser with scopes `read,activity:read_all`
2. Spins up a temporary localhost HTTP server to catch the OAuth callback
3. Exchanges the authorization code for tokens via Strava's token endpoint
4. Writes `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, and `STRAVA_REFRESH_TOKEN` to `.env`

### Runtime token refresh (`auth.ts`)

- Holds the current access token and its expiry in memory
- Before every API call, checks if the token expires within 5 minutes
- If so, POSTs to Strava's token endpoint using the stored refresh token and updates the in-memory token
- The `.env` refresh token is never rotated (Strava refresh tokens are long-lived)

---

## MCP Tools

### `get_athlete_profile`
Returns basic athlete info and all-time Strava stats.

**Strava calls:** `GET /athlete`, `GET /athletes/{id}/stats`  
**Returns:** name, profile photo URL, follower/following counts, all-time totals (runs/rides/swims: count, distance, time, elevation)

---

### `get_training_summary`
Pre-aggregated weekly training breakdown for the last N weeks (default: 4).

**Parameters:** `weeks` (integer, 1–52, default 4), `sport_type` (run/ride/swim/all, default all)  
**Strava calls:** `GET /athlete/activities` (paginated to cover the date range)  
**Returns:** per-week rows with: week start date, activity count, total distance, total time, total elevation, avg pace/speed, avg HR, intensity distribution (% easy/moderate/hard by HR zone), rest days count

---

### `get_recent_activities`
List of the most recent activities with key stats.

**Parameters:** `limit` (integer, 1–30, default 10)  
**Strava calls:** `GET /athlete/activities`  
**Returns:** per-activity: id, name, date, sport type, distance, moving time, avg pace/speed, avg HR, elevation gain, suffer score

---

### `get_activity_detail`
Deep dive on a single activity.

**Parameters:** `activity_id` (integer, required)  
**Strava calls:** `GET /activities/{id}`  
**Returns:** all fields from `get_recent_activities` plus: splits (per km or mile), HR zone breakdown (% time in each zone), best efforts, map polyline, gear used, segment efforts on the activity

---

### `get_fitness_trends`
Longer-term training trends for coaching/overtraining analysis.

**Parameters:** `weeks` (integer, 4–52, default 12)  
**Strava calls:** `GET /athlete/activities` (paginated)  
**Returns:** rolling weekly volume (distance + time), 4-week rolling average, longest active streak (days), biggest volume week, sport type breakdown over time, trend direction (increasing/stable/decreasing based on 4-week vs prior 4-week comparison)

---

### `get_segment_efforts`
Starred segments and best efforts.

**Parameters:** none  
**Strava calls:** `GET /segments/starred`, then `GET /segments/{id}/all_efforts` per segment (up to 10 starred segments)  
**Returns:** per segment: name, distance, avg grade, athlete's KOM/CR status, PR time, number of efforts, last effort date

---

### `get_gear_summary`
Bikes and shoes with mileage tracking.

**Parameters:** none  
**Strava calls:** `GET /athlete` (gear IDs embedded), then `GET /gear/{id}` per item  
**Returns:** per gear item: name, type (bike/shoes), brand/model, total distance, retired status

---

## Units

All distance and pace values follow the athlete's Strava profile measurement preference (metric vs imperial). The `strava-client.ts` layer reads `measurement_preference` from the athlete profile on startup and applies consistent unit formatting across all tools.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| 429 Too Many Requests | Return message: "Strava rate limit reached. Try again in X minutes." (parse `X-RateLimit-Reset` header) |
| 401 Unauthorized | Attempt one silent token refresh, retry call. If still 401, return: "Strava authentication failed. Run `npm run setup` to re-authenticate." |
| Network error | Return: "Failed to reach Strava API: [tool name]. Check your connection." |
| Empty result | Return descriptive empty state, e.g.: "No activities found in the last 4 weeks." |

No retry loops or backoff. Errors are surfaced cleanly to Claude.

---

## Rate Limits

Strava enforces 200 requests per 15 minutes and 2,000 per day. Each tool call triggers 1–10 API requests depending on data volume (e.g., `get_segment_efforts` with 10 starred segments = ~11 calls). For personal use this is well within limits.

---

## Tech Stack

- **Runtime:** Node.js (LTS)
- **Language:** TypeScript
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **HTTP:** Native `fetch` (Node 18+), no extra HTTP libs
- **Config:** `dotenv` for `.env` loading
- **Build:** `tsc` → `dist/`, `tsx` for dev/scripts
