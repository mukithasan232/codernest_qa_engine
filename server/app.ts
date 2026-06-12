/**
 * @fileoverview Express application — CoderNest QA Core.
 * Serves the QA Dashboard and exposes API endpoints for:
 * - Unit test results (Jest)
 * - Smart QA scan (Playwright engine)
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as fs   from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { Logger }       from '../core/logger';
import { runSmartScan, scanState } from '../core/TestOrchestrator';

const app: Application = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files: dashboard HTML + screenshots
app.use(express.static(path.join(__dirname, '../public')));
app.use('/reports', express.static(path.join(process.cwd(), 'reports')));

app.use((req: Request, _res: Response, next: NextFunction) => {
  Logger.info(`→ ${req.method} ${req.path}`);
  next();
});

// Favicon Bypass (Required for Vercel Serverless)
app.get('/favicon.ico', (req, res) => res.status(204).end());

// ── State (Unit Tests) ──────────────────────────────────────────────────────
let isUnitRunning = false;
const RESULTS_PATH = path.resolve(process.cwd(), 'reports', 'results.json');

// ── Unit Test API ───────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'CoderNest QA Core API', version: '2.0.0', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.get('/api/v1/status', (_req, res) => {
  res.json({ status: 'operational', environment: process.env['NODE_ENV'] ?? 'development' });
});

app.post('/api/v1/echo', (req: Request, res: Response) => {
  res.json({ received: req.body as unknown, echoedAt: new Date().toISOString() });
});

/**
 * GET /api/v1/results — Latest Jest unit test results.
 */
app.get('/api/v1/results', (_req, res) => {
  if (!fs.existsSync(RESULTS_PATH)) {
    res.json({ exists: false, isRunning: isUnitRunning, message: 'No results yet.' });
    return;
  }
  try {
    const data = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf-8')) as unknown;
    res.json({ exists: true, isRunning: isUnitRunning, data });
  } catch {
    res.status(500).json({ error: 'Failed to parse results file.' });
  }
});

/**
 * POST /api/v1/run-tests — Triggers npm test in a child process.
 */
app.post('/api/v1/run-tests', (_req, res) => {
  if (isUnitRunning) {
    res.status(409).json({ status: 'already_running' });
    return;
  }
  isUnitRunning = true;
  const child = spawn('npm', ['test', '--', '--forceExit'], { cwd: process.cwd(), shell: true, stdio: 'pipe' });
  child.on('close', (code) => { isUnitRunning = false; Logger.success(`Unit test run exited ${code}.`); });
  child.on('error', (err) => { isUnitRunning = false; Logger.error('Unit test child error.', err); });
  res.status(202).json({ status: 'started' });
});

// ── Smart QA API ────────────────────────────────────────────────────────────

/**
 * GET /api/v1/smart-status — Returns live scan progress.
 */
app.get('/api/v1/smart-status', (_req, res) => {
  res.json(scanState);
});

/**
 * POST /api/v1/smart-test — Starts a Smart QA scan for a given URL.
 * Body: { url: string }
 */
app.post('/api/v1/smart-test', (req: Request, res: Response) => {
  const { url } = req.body as { url?: string };

  if (!url) {
    res.status(400).json({ error: 'Request body must include a "url" field.' });
    return;
  }

  try { new URL(url); } catch {
    res.status(400).json({ error: 'Invalid URL provided.' });
    return;
  }

  if (scanState.status === 'crawling' || scanState.status === 'testing') {
    res.status(409).json({ error: 'A scan is already in progress.' });
    return;
  }

  // Start scan asynchronously — do not await
  void runSmartScan(url);

  res.status(202).json({ status: 'started', message: 'Scan initiated. Poll /api/v1/smart-status for updates.' });
});

/**
 * POST /api/v1/audit — Synchronous dynamic audit.
 * Body: { targetUrl: string, authToken?: string }
 */
import { DynamicEngine } from '../src/engine/dynamicEngine';

app.post('/api/v1/audit', async (req: Request, res: Response): Promise<void> => {
  const { targetUrl, authToken } = req.body as { targetUrl?: string; authToken?: string };

  if (!targetUrl) {
    res.status(400).json({ error: 'Request body must include a "targetUrl" field.' });
    return;
  }

  try { new URL(targetUrl); } catch {
    res.status(400).json({ error: 'Invalid URL provided.' });
    return;
  }

  try {
    const engine = new DynamicEngine(targetUrl, authToken);
    const reportData = await engine.runScan();
    res.json(reportData);
  } catch (error: any) {
    res.status(500).json({ error: 'Dynamic audit failed.', details: error.message });
  }
});

// ── Dashboard & Static ──────────────────────────────────────────────────────

app.get('/dashboard', (_req, res) => {
  const htmlPath = path.join(__dirname, '../public/dashboard.html');
  if (fs.existsSync(htmlPath)) res.sendFile(htmlPath);
  else res.status(404).send('Dashboard not found.');
});

app.get('/', (_req, res) => { res.redirect('/dashboard'); });

// ── 404 / Error ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

export default app;
