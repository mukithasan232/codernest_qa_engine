/**
 * @fileoverview Test Orchestrator — coordinates all Smart QA test modules and
 * updates the live scan progress state.
 */

import { SmartCrawler }        from './SmartCrawler';
import { runLinkChecker }       from '../utils/LinkChecker';
import { runA11yScan }          from '../utils/A11yScanner';
import { runPerfAnalysis }      from '../utils/PerfAnalyzer';
import { runSecurityAudit }     from '../utils/SecurityAudit';
import { captureScreenshots }   from '../utils/ScreenshotService';
import { runFormAnalysis }      from '../utils/FormTester';
import { Logger }               from './logger';
import type { SmartReport, ScanProgress } from '../types/SmartReport';

// ── Singleton scan state shared with Express ────────────────────────────────
export const scanState: ScanProgress = {
  status:       'idle',
  progress:     0,
  step:         'Idle',
  targetUrl:    '',
  pagesFound:   0,
  pagesTested:  0,
  startedAt:    null,
  completedAt:  null,
  report:       null,
  error:        null,
};

function updateState(patch: Partial<ScanProgress>): void {
  Object.assign(scanState, patch);
}

/**
 * Runs the full Smart QA scan for the given URL.
 * Updates `scanState` throughout for live dashboard polling.
 *
 * @param targetUrl - The URL to scan.
 */
export async function runSmartScan(targetUrl: string): Promise<void> {
  updateState({
    status:      'crawling',
    progress:    5,
    step:        'Initialising crawler…',
    targetUrl,
    pagesFound:  0,
    pagesTested: 0,
    startedAt:   new Date().toISOString(),
    completedAt: null,
    report:      null,
    error:       null,
  });

  try {
    // ── Phase 1: Crawl ──────────────────────────────────────────────────────
    Logger.info('Orchestrator: Phase 1 — Crawl');
    const crawler = new SmartCrawler(20);
    const pages   = await crawler.crawl(targetUrl, (msg) => {
      updateState({ step: msg, progress: Math.min(25, scanState.progress + 1) });
    });

    updateState({ pagesFound: pages.length, progress: 30, status: 'testing' });
    const urls = pages.map((p) => p.url);

    // ── Phase 2: Link Checker ───────────────────────────────────────────────
    Logger.info('Orchestrator: Phase 2 — Link checker');
    updateState({ step: 'Checking all links for broken URLs…', progress: 35 });
    const navigation = await runLinkChecker(pages);

    // ── Phase 3: Accessibility ──────────────────────────────────────────────
    Logger.info('Orchestrator: Phase 3 — Accessibility');
    updateState({ step: 'Running WCAG accessibility scan…', progress: 45 });
    const accessibility = await runA11yScan(urls, (msg) => updateState({ step: msg }));

    // ── Phase 4: Performance ────────────────────────────────────────────────
    Logger.info('Orchestrator: Phase 4 — Performance');
    updateState({ step: 'Measuring page performance…', progress: 60 });
    const performance = await runPerfAnalysis(urls, (msg) => updateState({ step: msg }));

    // ── Phase 5: Security ───────────────────────────────────────────────────
    Logger.info('Orchestrator: Phase 5 — Security');
    updateState({ step: 'Auditing security headers…', progress: 72 });
    const security = await runSecurityAudit(targetUrl);

    // ── Phase 6: Forms ──────────────────────────────────────────────────────
    Logger.info('Orchestrator: Phase 6 — Forms');
    updateState({ step: 'Analysing forms…', progress: 80 });
    const forms = runFormAnalysis(pages);

    // ── Phase 7: Screenshots ────────────────────────────────────────────────
    Logger.info('Orchestrator: Phase 7 — Screenshots');
    updateState({ step: 'Capturing screenshots at 3 viewports…', progress: 85 });
    const screenshots = await captureScreenshots(urls, (msg) => updateState({ step: msg }));

    // ── Aggregate score ─────────────────────────────────────────────────────
    const overallScore = Math.round(
      navigation.score    * 0.30 +
      accessibility.score * 0.25 +
      performance.score   * 0.20 +
      security.score      * 0.15 +
      forms.score         * 0.10
    );

    const report: SmartReport = {
      targetUrl,
      timestamp:    new Date().toISOString(),
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
      status:      'complete',
      progress:    100,
      step:        'Scan complete!',
      pagesTested: pages.length,
      completedAt: new Date().toISOString(),
      report,
    });

    Logger.success(`Smart QA scan complete! Overall score: ${overallScore}/100`);
  } catch (err) {
    const message = (err as Error).message;
    Logger.error('Smart QA scan failed.', err);
    updateState({
      status:  'error',
      step:    'Scan failed.',
      error:   message,
      completedAt: new Date().toISOString(),
    });
  }
}
