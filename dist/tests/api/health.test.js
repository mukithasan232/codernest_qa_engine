"use strict";
/**
 * @fileoverview Health Check API Test Suite.
 *
 * Uses Supertest with the Express `app` instance directly — no running server required.
 * Supertest binds the app to an ephemeral OS-assigned port per test run.
 *
 * Path aliases: @core/CoreUtils, @core/logger
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../server/app"));
const CoreUtils_1 = require("@core/CoreUtils");
const logger_1 = require("@core/logger");
// ─── Test Suite ────────────────────────────────────────────────────────────
describe('GET /health — Health Check', () => {
    const agent = (0, supertest_1.default)(app_1.default);
    const headers = CoreUtils_1.CoreUtils.getGlobalHeaders();
    beforeAll(() => {
        logger_1.Logger.info('Health Check test suite initialized.');
    });
    it('should return HTTP 200', async () => {
        const res = await agent.get('/health').set(headers);
        expect(res.status).toBe(200);
    });
    it('response body should have status: "ok"', async () => {
        const res = await agent.get('/health').set(headers);
        expect(res.body).toHaveProperty('status', 'ok');
    });
    it('response body should include service name and version', async () => {
        const res = await agent.get('/health').set(headers);
        expect(res.body).toHaveProperty('service', 'CoderNest QA Core API');
        expect(res.body).toHaveProperty('version', '2.0.0');
    });
    it('Content-Type should be application/json', async () => {
        const res = await agent.get('/health').set(headers);
        expect(res.headers['content-type']).toMatch(/application\/json/);
    });
    it('should return HTTP 404 for an unknown route', async () => {
        const res = await agent.get('/nonexistent-route-xyz').set(headers);
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('status', 'error');
    });
});
// ─── Status Endpoint Suite ─────────────────────────────────────────────────
describe('GET /api/v1/status — Extended Status', () => {
    const agent = (0, supertest_1.default)(app_1.default);
    const headers = CoreUtils_1.CoreUtils.getGlobalHeaders();
    it('should return HTTP 200', async () => {
        const res = await agent.get('/api/v1/status').set(headers);
        expect(res.status).toBe(200);
    });
    it('response body should have status: "operational"', async () => {
        const res = await agent.get('/api/v1/status').set(headers);
        expect(res.body).toHaveProperty('status', 'operational');
    });
    it('response body should include environment field', async () => {
        const res = await agent.get('/api/v1/status').set(headers);
        expect(res.body).toHaveProperty('environment');
    });
});
// ─── Echo Endpoint Suite ───────────────────────────────────────────────────
describe('POST /api/v1/echo — Echo Endpoint', () => {
    const agent = (0, supertest_1.default)(app_1.default);
    const headers = CoreUtils_1.CoreUtils.getGlobalHeaders();
    const payload = { message: 'CoderNest ping', value: 42 };
    it('should return HTTP 200', async () => {
        const res = await agent.post('/api/v1/echo').set(headers).send(payload);
        expect(res.status).toBe(200);
    });
    it('should echo the request body under the "received" key', async () => {
        const res = await agent.post('/api/v1/echo').set(headers).send(payload);
        expect(res.body).toHaveProperty('received');
        expect(res.body.received).toMatchObject(payload);
    });
    it('should include an "echoedAt" ISO timestamp', async () => {
        const res = await agent.post('/api/v1/echo').set(headers).send(payload);
        expect(res.body).toHaveProperty('echoedAt');
        expect(() => new Date(res.body.echoedAt)).not.toThrow();
    });
});
