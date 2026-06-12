/**
 * @fileoverview Global Jest setup file.
 * Runs once before all test suites begin — ideal for validating environment
 * configuration and ensuring all required env vars are present before tests start.
 */

import * as dotenv from 'dotenv';

export default async function globalSetup(): Promise<void> {
  // Load .env into process.env for all test processes
  dotenv.config();

  console.log('\n[GlobalSetup] Environment loaded. Validating required variables...');

  const REQUIRED_VARS = ['API_BASE_URL'] as const;

  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) {
      throw new Error(
        `[GlobalSetup] FATAL: Required environment variable "${key}" is not set. ` +
        `Create a .env file at the project root or set it in your CI/CD pipeline secrets.`
      );
    }
  }

  console.log('[GlobalSetup] All required environment variables are present. ✓\n');
}
