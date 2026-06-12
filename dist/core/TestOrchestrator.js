"use strict";
/**
 * @fileoverview Test Orchestrator — coordinates all Smart QA test modules and
 * updates the live scan progress state.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanState = void 0;
exports.runSmartScan = runSmartScan;
const SmartCrawler_1 = require("@core/SmartCrawler");
const LinkChecker_1 = require("../utils/LinkChecker");
const A11yScanner_1 = require("../utils/A11yScanner");
const PerfAnalyzer_1 = require("../utils/PerfAnalyzer");
const SecurityAudit_1 = require("../utils/SecurityAudit");
const ScreenshotService_1 = require("../utils/ScreenshotService");
const FormTester_1 = require("../utils/FormTester");
const logger_1 = require("@core/logger");
// ── Singleton scan state shared with Express ────────────────────────────────
exports.scanState = {
    status: 'idle',
    progress: 0,
    step: 'Idle',
    targetUrl: '',
    pagesFound: 0,
    pagesTested: 0,
    startedAt: null,
    completedAt: null,
    report: null,
    error: null,
};
function updateState(patch) {
    Object.assign(exports.scanState, patch);
}
/**
 * Runs the full Smart QA scan for the given URL.
 * Updates `scanState` throughout for live dashboard polling.
 *
 * @param targetUrl - The URL to scan.
 */
async function runSmartScan(targetUrl) {
    updateState({
        status: 'crawling',
        progress: 5,
        step: 'Initialising crawler…',
        targetUrl,
        pagesFound: 0,
        pagesTested: 0,
        startedAt: new Date().toISOString(),
        completedAt: null,
        report: null,
        error: null,
    });
    try {
        // ── Phase 1: Crawl ──────────────────────────────────────────────────────
        logger_1.Logger.info('Orchestrator: Phase 1 — Crawl');
        const crawler = new SmartCrawler_1.SmartCrawler(20);
        const pages = await crawler.crawl(targetUrl, (msg) => {
            updateState({ step: msg, progress: Math.min(25, exports.scanState.progress + 1) });
        });
        updateState({ pagesFound: pages.length, progress: 30, status: 'testing' });
        const urls = pages.map((p) => p.url);
        // ── Phase 2: Link Checker ───────────────────────────────────────────────
        logger_1.Logger.info('Orchestrator: Phase 2 — Link checker');
        updateState({ step: 'Checking all links for broken URLs…', progress: 35 });
        const navigation = await (0, LinkChecker_1.runLinkChecker)(pages);
        // ── Phase 3: Accessibility ──────────────────────────────────────────────
        logger_1.Logger.info('Orchestrator: Phase 3 — Accessibility');
        updateState({ step: 'Running WCAG accessibility scan…', progress: 45 });
        const accessibility = await (0, A11yScanner_1.runA11yScan)(urls, (msg) => updateState({ step: msg }));
        // ── Phase 4: Performance ────────────────────────────────────────────────
        logger_1.Logger.info('Orchestrator: Phase 4 — Performance');
        updateState({ step: 'Measuring page performance…', progress: 60 });
        const performance = await (0, PerfAnalyzer_1.runPerfAnalysis)(urls, (msg) => updateState({ step: msg }));
        // ── Phase 5: Security ───────────────────────────────────────────────────
        logger_1.Logger.info('Orchestrator: Phase 5 — Security');
        updateState({ step: 'Auditing security headers…', progress: 72 });
        const security = await (0, SecurityAudit_1.runSecurityAudit)(targetUrl);
        // ── Phase 6: Forms ──────────────────────────────────────────────────────
        logger_1.Logger.info('Orchestrator: Phase 6 — Forms');
        updateState({ step: 'Analysing forms…', progress: 80 });
        const forms = (0, FormTester_1.runFormAnalysis)(pages);
        // ── Phase 7: Screenshots ────────────────────────────────────────────────
        logger_1.Logger.info('Orchestrator: Phase 7 — Screenshots');
        updateState({ step: 'Capturing screenshots at 3 viewports…', progress: 85 });
        const screenshots = await (0, ScreenshotService_1.captureScreenshots)(urls, (msg) => updateState({ step: msg }));
        // ── Aggregate score ─────────────────────────────────────────────────────
        const overallScore = Math.round(navigation.score * 0.30 +
            accessibility.score * 0.25 +
            performance.score * 0.20 +
            security.score * 0.15 +
            forms.score * 0.10);
        const report = {
            targetUrl,
            timestamp: new Date().toISOString(),
            pagesScanned: pages.length,
            overallScore,
            navigation,
            accessibility,
            performance,
            security,
            forms,
            screenshots,
            pages,
        };
        updateState({
            status: 'complete',
            progress: 100,
            step: 'Scan complete!',
            pagesTested: pages.length,
            completedAt: new Date().toISOString(),
            report,
        });
        logger_1.Logger.success(`Smart QA scan complete! Overall score: ${overallScore}/100`);
    }
    catch (err) {
        const message = err.message;
        logger_1.Logger.error('Smart QA scan failed.', err);
        updateState({
            status: 'error',
            step: 'Scan failed.',
            error: message,
            completedAt: new Date().toISOString(),
        });
    }
}
