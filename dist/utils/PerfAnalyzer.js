"use strict";
/**
 * @fileoverview Performance Analyzer — measures full Core Web Vitals and
 * Navigation Timing metrics for every discovered page using Playwright's
 * CDP (Chrome DevTools Protocol) session alongside browser-side performance APIs.
 *
 * Metrics collected:
 *  - Navigation Timing: DNS, TCP, TTFB, response time, DOMContentLoaded, total load
 *  - Paint Metrics:     FCP (First Contentful Paint), LCP (Largest Contentful Paint)
 *  - Layout Shift:      CLS (Cumulative Layout Shift)
 *
 * Each metric is classified according to Google's Core Web Vitals thresholds:
 *  🟢 Good | 🟡 Needs Improvement | 🔴 Poor
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPerfAnalysis = runPerfAnalysis;
const playwright_1 = require("playwright");
const logger_1 = require("@core/logger");
// ─── Core Web Vitals Thresholds (Google 2024) ─────────────────────────────
const THRESHOLDS = {
    /** Largest Contentful Paint thresholds in ms */
    lcp: { good: 2500, poor: 4000 },
    /** First Contentful Paint thresholds in ms */
    fcp: { good: 1800, poor: 3000 },
    /** Cumulative Layout Shift thresholds (dimensionless) */
    cls: { good: 0.1, poor: 0.25 },
    /** Time To First Byte thresholds in ms */
    ttfb: { good: 200, poor: 600 },
};
// ─── Rating Helpers ───────────────────────────────────────────────────────
/**
 * Classifies a numeric value against Good/Needs-Improvement/Poor thresholds.
 *
 * @param value - The raw metric value.
 * @param good  - Upper bound for "Good".
 * @param poor  - Lower bound for "Poor" (anything ≥ poor is rated Poor).
 * @returns A {@link WebVitalRating}.
 */
function rateMetric(value, good, poor) {
    if (value <= good)
        return 'good';
    if (value < poor)
        return 'needs-improvement';
    return 'poor';
}
/**
 * Converts a {@link WebVitalRating} to an overall page load category.
 * Uses the worst rating across LCP, CLS, and FCP.
 */
function deriveOverallRating(paint, layout) {
    const ratings = [paint.lcpRating, paint.fcpRating, layout.clsRating];
    if (ratings.includes('poor'))
        return 'slow';
    if (ratings.includes('needs-improvement'))
        return 'moderate';
    return 'fast';
}
// ─── Browser-side Metric Collectors ──────────────────────────────────────
/**
 * Collects Navigation Timing data via `performance.getEntriesByType('navigation')`.
 * Falls back to 0 for any metric that cannot be read.
 */
async function collectNavigationTiming(page) {
    return page.evaluate(() => {
        const [nav] = performance.getEntriesByType('navigation');
        if (!nav) {
            return {
                dnsLookup: 0, tcpConnection: 0, ttfb: 0,
                responseTime: 0, domInteractive: 0,
                domContentLoaded: 0, totalLoad: 0,
            };
        }
        return {
            dnsLookup: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
            tcpConnection: Math.round(nav.connectEnd - nav.connectStart),
            ttfb: Math.round(nav.responseStart - nav.requestStart),
            responseTime: Math.round(nav.responseEnd - nav.responseStart),
            domInteractive: Math.round(nav.domInteractive - nav.startTime),
            domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
            totalLoad: Math.round(nav.loadEventEnd - nav.startTime),
        };
    }).catch(() => ({
        dnsLookup: 0, tcpConnection: 0, ttfb: 0,
        responseTime: 0, domInteractive: 0,
        domContentLoaded: 0, totalLoad: 0,
    }));
}
/**
 * Collects FCP via `performance.getEntriesByName('first-contentful-paint')`.
 * Collects LCP via `PerformanceObserver` with a 4-second observation window.
 */
async function collectPaintMetrics(page) {
    const [fcp, lcp] = await Promise.all([
        // ── FCP ──────────────────────────────────────────────────────────────
        page.evaluate(() => {
            const entries = performance.getEntriesByName('first-contentful-paint');
            return Math.round(entries[0]?.startTime ?? 0);
        }).catch(() => 0),
        // ── LCP — via buffered PerformanceObserver ────────────────────────────
        page.evaluate(() => new Promise((resolve) => {
            let latest = 0;
            try {
                const obs = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    if (entries.length > 0) {
                        latest = Math.round(entries[entries.length - 1].startTime);
                    }
                });
                obs.observe({ type: 'largest-contentful-paint', buffered: true });
                // Allow 4 seconds for LCP to settle before resolving
                setTimeout(() => { obs.disconnect(); resolve(latest); }, 4000);
            }
            catch {
                resolve(0);
            }
        })).catch(() => 0),
    ]);
    return {
        fcp,
        fcpRating: rateMetric(fcp, THRESHOLDS.fcp.good, THRESHOLDS.fcp.poor),
        lcp,
        lcpRating: rateMetric(lcp, THRESHOLDS.lcp.good, THRESHOLDS.lcp.poor),
    };
}
/**
 * Collects the Cumulative Layout Shift score via the Layout Instability API.
 * Observes for 4 seconds, accumulating all unexpected layout shifts.
 */
async function collectLayoutShift(page) {
    const cls = await page.evaluate(() => new Promise((resolve) => {
        let score = 0;
        try {
            const obs = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    // Only count shifts not caused by user input
                    if (!entry.hadRecentInput) {
                        score += entry.value;
                    }
                }
            });
            obs.observe({ type: 'layout-shift', buffered: true });
            setTimeout(() => {
                obs.disconnect();
                resolve(Math.round(score * 1000) / 1000); // 3 decimal places
            }, 4000);
        }
        catch {
            resolve(0);
        }
    })).catch(() => 0);
    return {
        cls,
        clsRating: rateMetric(cls, THRESHOLDS.cls.good, THRESHOLDS.cls.poor),
    };
}
/**
 * Extracts additional CDP-level performance metrics (TaskDuration, ScriptDuration, etc.)
 * for debugging and extended reporting.
 *
 * @param cdp - An active {@link CDPSession}.
 * @returns A `Record<string, number>` of CDP metric names to values.
 */
async function collectCDPMetrics(cdp) {
    try {
        const response = await cdp.send('Performance.getMetrics');
        return Object.fromEntries(response.metrics.map((m) => [m.name, m.value]));
    }
    catch {
        return {};
    }
}
// ─── Scoring ──────────────────────────────────────────────────────────────
/**
 * Computes a 0–100 score for the {@link PerformanceReport} based on
 * LCP, CLS, FCP, and TTFB ratings across all pages.
 *
 * Weights:
 *  - LCP:  40%
 *  - CLS:  30%
 *  - FCP:  20%
 *  - TTFB: 10%
 */
function computeScore(pages) {
    if (pages.length === 0)
        return 100;
    const ratingToScore = (r) => r === 'good' ? 100 : r === 'needs-improvement' ? 60 : 20;
    const avg = (fn) => pages.reduce((sum, p) => sum + fn(p), 0) / pages.length;
    const score = avg((p) => ratingToScore(p.paint.lcpRating)) * 0.40 +
        avg((p) => ratingToScore(p.layoutShift.clsRating)) * 0.30 +
        avg((p) => ratingToScore(p.paint.fcpRating)) * 0.20 +
        avg((p) => ratingToScore(rateMetric(p.navigation.ttfb, THRESHOLDS.ttfb.good, THRESHOLDS.ttfb.poor))) * 0.10;
    return Math.round(score);
}
// ─── Public API ───────────────────────────────────────────────────────────
/**
 * Measures Core Web Vitals and Navigation Timing for each provided URL.
 *
 * Each page is loaded in a dedicated Playwright tab with a CDP session attached.
 * Metrics are observed for up to 4 seconds to allow LCP and CLS to settle.
 *
 * @param urls       - Array of page URLs to measure.
 * @param onProgress - Optional callback called with a progress string per page.
 * @returns A fully typed {@link PerformanceReport}.
 *
 * @example
 * ```ts
 * const report = await runPerfAnalysis(['https://my-app.vercel.app'], console.log);
 * console.log(report.pages[0].paint.lcpRating); // 'good' | 'needs-improvement' | 'poor'
 * ```
 */
async function runPerfAnalysis(urls, onProgress) {
    logger_1.Logger.info(`PerfAnalyzer: measuring ${urls.length} pages with Core Web Vitals…`);
    const pages = [];
    const browser = await playwright_1.chromium.launch({ headless: true });
    try {
        for (const url of urls) {
            onProgress?.(`⚡ Performance: measuring ${url}`);
            logger_1.Logger.debug(`PerfAnalyzer → ${url}`);
            const context = await browser.newContext();
            const page = await context.newPage();
            const cdpSession = await context.newCDPSession(page);
            try {
                // Enable CDP Performance domain before navigation
                await cdpSession.send('Performance.enable', { timeDomain: 'timeTicks' });
                await page.goto(url, { waitUntil: 'load', timeout: 30000 });
                // Collect all metrics in parallel where possible
                const [navTiming, cdpMetrics] = await Promise.all([
                    collectNavigationTiming(page),
                    collectCDPMetrics(cdpSession),
                ]);
                // Paint and CLS need observation time — collect sequentially
                const [paintMetrics, layoutShift] = await Promise.all([
                    collectPaintMetrics(page),
                    collectLayoutShift(page),
                ]);
                const overallRating = deriveOverallRating(paintMetrics, layoutShift);
                const pagePerfRecord = {
                    url,
                    navigation: navTiming,
                    paint: paintMetrics,
                    layoutShift,
                    rating: overallRating,
                    // Backward-compatible aliases
                    loaded: navTiming.totalLoad,
                    firstByte: navTiming.ttfb,
                    domContentLoaded: navTiming.domContentLoaded,
                };
                pages.push(pagePerfRecord);
                logger_1.Logger.info(`PerfAnalyzer ${url}: ` +
                    `LCP=${paintMetrics.lcp}ms(${paintMetrics.lcpRating}) ` +
                    `CLS=${layoutShift.cls}(${layoutShift.clsRating}) ` +
                    `FCP=${paintMetrics.fcp}ms(${paintMetrics.fcpRating}) ` +
                    `TTFB=${navTiming.ttfb}ms | ` +
                    `CDP TaskDuration=${cdpMetrics['TaskDuration'] ?? 'n/a'}`);
            }
            catch (err) {
                logger_1.Logger.warn(`PerfAnalyzer failed on ${url}: ${err.message}`);
            }
            finally {
                await cdpSession.detach().catch(() => null);
                await page.close().catch(() => null);
                await context.close().catch(() => null);
            }
        }
    }
    finally {
        await browser.close().catch(() => null);
    }
    const avgLoad = pages.length
        ? Math.round(pages.reduce((s, p) => s + p.navigation.totalLoad, 0) / pages.length)
        : 0;
    const score = computeScore(pages);
    logger_1.Logger.success(`PerfAnalyzer complete: ${pages.length} pages, avg load ${avgLoad}ms, score ${score}/100`);
    return { pages, avgLoad, score };
}
