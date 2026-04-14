import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StravaApiError, getAthleteCached, getGear } from '../strava-client.js';
import { formatDistance } from '../utils/dates.js';
import type { StravaGear, StravaGearSummary } from '../types.js';

async function formatGearItem(
  summary: StravaGearSummary,
  preference: 'feet' | 'meters',
) {
  const detail: StravaGear = await getGear(summary.id);

  return {
    id: summary.id,
    name: detail.name,
    brand: detail.brand_name ?? null,
    model: detail.model_name ?? null,
    distance: formatDistance(detail.distance, preference),
    primary: summary.primary,
    retired: detail.retired,
  };
}

export async function buildGearSummary() {
  const athlete = await getAthleteCached();
  const preference = athlete.measurement_preference;

  const [bikes, shoes] = await Promise.all([
    Promise.all(athlete.bikes.map((bike) => formatGearItem(bike, preference))),
    Promise.all(athlete.shoes.map((shoe) => formatGearItem(shoe, preference))),
  ]);

  return { bikes, shoes };
}

export function registerGearTools(server: McpServer): void {
  server.tool(
    'get_gear_summary',
    'List all Strava bikes and shoes with mileage, brand, model, and retired status.',
    {},
    async () => {
      try {
        const gear = await buildGearSummary();
        if (gear.bikes.length === 0 && gear.shoes.length === 0) {
          return { content: [{ type: 'text', text: 'No gear found on your Strava account.' }] };
        }

        return { content: [{ type: 'text', text: JSON.stringify(gear, null, 2) }] };
      } catch (error) {
        if (error instanceof StravaApiError) {
          return { content: [{ type: 'text', text: error.message }] };
        }

        throw error;
      }
    },
  );
}
