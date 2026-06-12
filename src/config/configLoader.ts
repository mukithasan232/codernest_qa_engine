import fs from 'fs';
import path from 'path';

export interface EndpointConfig {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
}

export interface QAConfig {
  baseUrl: string;
  endpoints: EndpointConfig[];
  secureEndpoints: EndpointConfig[];
  databaseEndpoint: EndpointConfig;
  authToken: string;
}

/**
 * Loads and parses the root config.json file safely.
 */
export function loadConfig(): QAConfig {
  try {
    const configPath = path.resolve(process.cwd(), 'config.json');
    const rawData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(rawData) as QAConfig;
  } catch (error: any) {
    throw new Error(`Failed to load config.json: ${error.message}`);
  }
}
