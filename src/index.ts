import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerActivityTools } from './tools/activities.js';
import { registerAthleteTools } from './tools/athlete.js';
import { registerGearTools } from './tools/gear.js';
import { registerSegmentTools } from './tools/segments.js';
import { registerTrainingTools } from './tools/training.js';

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
