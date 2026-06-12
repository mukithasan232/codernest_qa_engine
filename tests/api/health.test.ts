/**
 * @fileoverview Health Check API Test Suite.
 * Verifies the base API endpoint is reachable and returns the expected response.
 *
 * Path alias: @core/CoreUtils, @core/logger
 * Supertest: requests are made via a shared agent for DRY header management.
 */

import { CoreUtils } from '@core/CoreUtils';
import { Logger } from '@core/logger';

// ─── Test Suite ────────────────────────────────────────────────────────────

describe('API Health Check', () => {
  let agent: ReturnType<typeof CoreUtils.getSupertestAgent>;

  /**
   * Create a shared Supertest agent once before all tests in this suite.
   * This avoids re-creating the agent on every `it` block.
   */
  beforeAll(() => {
    agent = CoreUtils.getSupertestAgent();
    Logger.info('Supertest agent initialized for Health Check suite.');
  });

  // ── Test Cases ────────────────────────────────────────────────────────

  it('GET /health → should return HTTP 200', async () => {
    const response = await agent
      .get('/health')
      .set(CoreUtils.getGlobalHeaders());

    Logger.debug(`Response status: ${response.status}`);
    expect(response.status).toBe(200);
  });

  it('GET /health → response body should contain a status field', async () => {
    const response = await agent
      .get('/health')
      .set(CoreUtils.getGlobalHeaders());

    expect(response.body).toHaveProperty('status');
  });

  it('GET /health → Content-Type should be application/json', async () => {
    const response = await agent
      .get('/health')
      .set(CoreUtils.getGlobalHeaders());

    expect(response.headers['content-type']).toMatch(/application\/json/);
  });

  it('GET /nonexistent → should return HTTP 404', async () => {
    const response = await agent
      .get('/nonexistent-route-xyz')
      .set(CoreUtils.getGlobalHeaders());

    expect(response.status).toBe(404);
  });
});
