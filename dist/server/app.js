"use strict";
/**
 * @fileoverview Express application — CoderNest QA Core.
 * Serves the QA Dashboard and exposes API endpoints for:
 * - Unit test results (Jest)
 * - Smart QA scan (Playwright engine)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const logger_1 = require("@core/logger");
const TestOrchestrator_1 = require("@core/TestOrchestrator");
const app = (0, express_1.default)();
// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Serve static files: dashboard HTML + screenshots
app.use(express_1.default.static(path.join(__dirname, '../public')));
app.use('/reports', express_1.default.static(path.join(process.cwd(), 'reports')));
app.use((req, _res, next) => {
    logger_1.Logger.info(`→ ${req.method} ${req.path}`);
    next();
});
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
app.post('/api/v1/echo', (req, res) => {
    res.json({ received: req.body, echoedAt: new Date().toISOString() });
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
        const data = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf-8'));
        res.json({ exists: true, isRunning: isUnitRunning, data });
    }
    catch {
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
    const child = (0, child_process_1.spawn)('npm', ['test', '--', '--forceExit'], { cwd: process.cwd(), shell: true, stdio: 'pipe' });
    child.on('close', (code) => { isUnitRunning = false; logger_1.Logger.success(`Unit test run exited ${code}.`); });
    child.on('error', (err) => { isUnitRunning = false; logger_1.Logger.error('Unit test child error.', err); });
    res.status(202).json({ status: 'started' });
});
// ── Smart QA API ────────────────────────────────────────────────────────────
/**
 * GET /api/v1/smart-status — Returns live scan progress.
 */
app.get('/api/v1/smart-status', (_req, res) => {
    res.json(TestOrchestrator_1.scanState);
});
/**
 * POST /api/v1/smart-test — Starts a Smart QA scan for a given URL.
 * Body: { url: string }
 */
app.post('/api/v1/smart-test', (req, res) => {
    const { url } = req.body;
    if (!url) {
        res.status(400).json({ error: 'Request body must include a "url" field.' });
        return;
    }
    try {
        new URL(url);
    }
    catch {
        res.status(400).json({ error: 'Invalid URL provided.' });
        return;
    }
    if (TestOrchestrator_1.scanState.status === 'crawling' || TestOrchestrator_1.scanState.status === 'testing') {
        res.status(409).json({ error: 'A scan is already in progress.' });
        return;
    }
    // Start scan asynchronously — do not await
    void (0, TestOrchestrator_1.runSmartScan)(url);
    res.status(202).json({ status: 'started', message: 'Scan initiated. Poll /api/v1/smart-status for updates.' });
});
// ── Dashboard & Static ──────────────────────────────────────────────────────
app.get('/dashboard', (_req, res) => {
    const htmlPath = path.join(__dirname, '../public/dashboard.html');
    if (fs.existsSync(htmlPath))
        res.sendFile(htmlPath);
    else
        res.status(404).send('Dashboard not found.');
});
app.get('/', (_req, res) => { res.redirect('/dashboard'); });
// ── 404 / Error ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ status: 'error', message: 'Route not found.' });
});
app.use((err, _req, res, _next) => {
    logger_1.Logger.error('Unhandled server error.', err);
    res.status(500).json({ status: 'error', message: 'Internal server error.' });
});
exports.default = app;
