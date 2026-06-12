/**
 * @fileoverview Express application — CoderNest QA Core.
 * Serves the dashboard UI and exposes API endpoints for test results and test execution.
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import * as fs   from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { Logger } from '@core/logger';

const app: Application = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  Logger.info(`→ ${req.method} ${req.path}`);
  next();
});

// ── State ──────────────────────────────────────────────────────────────────

/** Track if a test run is currently in progress. */
let isRunning = false;

const RESULTS_PATH = path.resolve(process.cwd(), 'reports', 'results.json');

// ── API Routes ─────────────────────────────────────────────────────────────

/**
 * GET /health
 * Basic health check — used by Supertest and uptime monitors.
 */
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status:      'ok',
    service:     'CoderNest QA Core API',
    version:     '2.0.0',
    timestamp:   new Date().toISOString(),
    uptime:      process.uptime(),
  });
});

/**
 * GET /api/v1/status
 * Extended environment status.
 */
app.get('/api/v1/status', (_req: Request, res: Response) => {
  res.status(200).json({
    status:      'operational',
    environment: process.env['NODE_ENV'] ?? 'development',
    message:     'CoderNest QA Core is running.',
  });
});

/**
 * POST /api/v1/echo
 * Echoes request body — used in integration tests.
 */
app.post('/api/v1/echo', (req: Request, res: Response) => {
  res.status(200).json({
    received:  req.body as unknown,
    echoedAt: new Date().toISOString(),
  });
});

/**
 * GET /api/v1/results
 * Returns the latest test run results from `reports/results.json`.
 */
app.get('/api/v1/results', (_req: Request, res: Response) => {
  if (!fs.existsSync(RESULTS_PATH)) {
    res.status(200).json({ exists: false, isRunning, message: 'No results yet. Run the test suite first.' });
    return;
  }

  try {
    const raw  = fs.readFileSync(RESULTS_PATH, 'utf-8');
    const data = JSON.parse(raw) as unknown;
    res.status(200).json({ exists: true, isRunning, data });
  } catch {
    res.status(500).json({ error: 'Failed to parse results file.' });
  }
});

/**
 * POST /api/v1/run-tests
 * Spawns `npm test` in a child process and updates `isRunning` flag.
 * The dashboard polls `/api/v1/results` to detect completion.
 */
app.post('/api/v1/run-tests', (_req: Request, res: Response) => {
  if (isRunning) {
    res.status(409).json({ status: 'already_running', message: 'A test run is already in progress.' });
    return;
  }

  isRunning = true;
  Logger.info('Test run triggered via dashboard API.');

  const child = spawn('npm', ['test', '--', '--forceExit'], {
    cwd:   process.cwd(),
    shell: true,
    stdio: 'pipe',
  });

  child.on('close', (code) => {
    isRunning = false;
    Logger.success(`Test run completed with exit code ${code ?? 'unknown'}.`);
  });

  child.on('error', (err) => {
    isRunning = false;
    Logger.error('Test run child process error.', err);
  });

  res.status(202).json({ status: 'started', message: 'Test run started. Poll /api/v1/results for updates.' });
});

/**
 * GET /dashboard
 * Serves the QA Dashboard HTML.
 */
app.get('/dashboard', (_req: Request, res: Response) => {
  const htmlPath = path.join(__dirname, '../public/dashboard.html');
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.status(404).send('Dashboard not found.');
  }
});

// Redirect root to dashboard
app.get('/', (_req: Request, res: Response) => {
  res.redirect('/dashboard');
});

// ── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ status: 'error', message: 'Route not found.' });
});

// ── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  Logger.error('Unhandled server error.', err);
  res.status(500).json({ status: 'error', message: 'Internal server error.' });
});

export default app;
