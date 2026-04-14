# strava-mcp

Read-only Strava MCP server for personal training analysis in Claude.

## Setup

### 1. Create a Strava API application

Create an app at https://www.strava.com/settings/api and set the authorization callback domain to `localhost`.

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET`.

### 3. Install dependencies and authenticate

```bash
npm install
npm run setup
```

This opens the Strava authorization page and stores the refresh token in `.env`.

### 4. Build

```bash
npm run build
```

### 5. Add to Claude Desktop

Claude Desktop config path:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

Add a server entry like this:

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

Restart Claude Desktop after saving the config.

## Tools

| Tool | Description |
| --- | --- |
| `get_athlete_profile` | Athlete profile, recent totals, YTD totals, all-time totals |
| `get_training_summary` | Weekly summary with volume, pace, HR, intensity, rest days |
| `get_fitness_trends` | Rolling volume, biggest week, streaks, trend direction |
| `get_recent_activities` | Recent activities with key stats |
| `get_activity_detail` | Detailed activity view with splits, efforts, gear, map |
| `get_segment_efforts` | Starred segment PRs and benchmarks |
| `get_gear_summary` | Bikes and shoes with mileage and model details |

## Development

```bash
npm run dev
npm test
npm run build
```
