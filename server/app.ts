/**
 * @fileoverview Express application factory for the CoderNest QA Core engine.
 * This module exports the configured `app` instance WITHOUT calling `.listen()`,
 * allowing Supertest to bind it to an ephemeral port during tests —
 * meaning NO running server is required to execute the test suite.
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import { Logger } from '@core/logger';

// ─── App Factory ───────────────────────────────────────────────────────────

const app: Application = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  Logger.info(`→ ${req.method} ${req.path}`);
  next();
});

// ── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /health
 * Primary health check endpoint consumed by the QA test suite.
 */
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'CoderNest QA Core API',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /api/v1/status
 * Extended status endpoint with environment metadata.
 */
app.get('/api/v1/status', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'operational',
    environment: process.env['NODE_ENV'] ?? 'development',
    message: 'CoderNest QA Core is running.',
  });
});

/**
 * POST /api/v1/echo
 * Echo endpoint — returns the request body back as JSON.
 * Useful for integration tests that validate request/response contracts.
 */
app.post('/api/v1/echo', (req: Request, res: Response) => {
  res.status(200).json({
    received: req.body as unknown,
    echoedAt: new Date().toISOString(),
  });
});

// ── 404 Fallback ────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ status: 'error', message: 'Route not found.' });
});

// ── Global Error Handler ────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  Logger.error('Unhandled server error.', err);
  res.status(500).json({ status: 'error', message: 'Internal server error.' });
});

export default app;
