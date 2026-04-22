/**
 * Load `server/.env` for scripts run via ts-node (seed, problems:import).
 * The Nest app uses ConfigModule; these entrypoints do not bootstrap Nest.
 */
import { config } from 'dotenv';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
config({ path: envPath });
