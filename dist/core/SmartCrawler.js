"use strict";
/**
 * @fileoverview Smart Crawler — Playwright-based site spider.
 * Discovers all pages, links, and forms within the target domain.
 * Respects a max-page limit and stays on the same origin.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartCrawler = void 0;
const playwright_1 = require("playwright");
const logger_1 = require("@core/logger");
class SmartCrawler {
    browser = null;
    visited = new Set();
    queue = [];
    baseOrigin = '';
    maxPages;
    constructor(maxPages = 20) {
        this.maxPages = maxPages;
    }
    /**
     * Crawls the target URL and all same-domain pages up to `maxPages`.
     *
     * @param startUrl   - The root URL to begin crawling from.
     * @param onProgress - Optional callback called with a status string each step.
     * @returns Array of discovered pages with metadata.
     */
    async crawl(startUrl, onProgress) {
        this.baseOrigin = new URL(startUrl).origin;
        this.queue = [this.normalise(startUrl)];
        this.visited = new Set();
        const pages = [];
        logger_1.Logger.info(`SmartCrawler starting at ${startUrl} (max ${this.maxPages} pages)`);
        this.browser = await playwright_1.chromium.launch({ headless: true });
        try {
            while (this.queue.length > 0 && pages.length < this.maxPages) {
                const url = this.queue.shift();
                if (this.visited.has(url))
                    continue;
                this.visited.add(url);
                onProgress?.(`Crawling (${pages.length + 1}/${this.maxPages}): ${url}`);
                logger_1.Logger.debug(`Visiting: ${url}`);
                const page = await this.browser.newPage();
                const start = Date.now();
                try {
                    const response = await page.goto(url, {
                        waitUntil: 'domcontentloaded',
                        timeout: 20000,
                    });
                    const statusCode = response?.status() ?? 0;
                    const loadTimeMs = Date.now() - start;
                    const title = await page.title().catch(() => '');
                    // ── Discover same-domain links ──────────────────────────────────
                    const links = await this.discoverLinks(page);
                    for (const link of links) {
                        if (!this.visited.has(link) && !this.queue.includes(link)) {
                            this.queue.push(link);
                        }
                    }
                    // ── Discover forms ──────────────────────────────────────────────
                    const forms = await this.discoverForms(page);
                    pages.push({ url, title, statusCode, links, forms, loadTimeMs });
                }
                catch (err) {
                    logger_1.Logger.warn(`Failed to crawl ${url}: ${err.message}`);
                    pages.push({
                        url, title: 'Error', statusCode: 0,
                        links: [], forms: [], loadTimeMs: Date.now() - start,
                    });
                }
                finally {
                    await page.close().catch(() => null);
                }
            }
        }
        finally {
            await this.browser.close().catch(() => null);
            this.browser = null;
        }
        logger_1.Logger.success(`Crawl complete — ${pages.length} pages discovered.`);
        return pages;
    }
    // ── Private helpers ───────────────────────────────────────────────────────
    async discoverLinks(page) {
        try {
            const hrefs = await page.evaluate(() => Array.from(document.querySelectorAll('a[href]'))
                .map((a) => a.href));
            return [...new Set(hrefs
                    .filter((h) => h.startsWith(this.baseOrigin))
                    .map((h) => this.normalise(h)))];
        }
        catch {
            return [];
        }
    }
    async discoverForms(page) {
        try {
            return await page.evaluate(() => Array.from(document.querySelectorAll('form')).map((form, i) => ({
                id: form.id || `form-${i}`,
                action: form.action || '',
                method: (form.method || 'get').toUpperCase(),
                fields: Array.from(form.querySelectorAll('input, select, textarea')).map((el) => {
                    const input = el;
                    const labelEl = input.id
                        ? document.querySelector(`label[for="${input.id}"]`)
                        : input.closest('label');
                    return {
                        name: input.name || input.id || '',
                        type: input.type || el.tagName.toLowerCase(),
                        required: input.required,
                        hasLabel: !!labelEl,
                    };
                }),
            })));
        }
        catch {
            return [];
        }
    }
    /** Strips hash fragments and trailing slashes for deduplication. */
    normalise(url) {
        try {
            const u = new URL(url);
            u.hash = '';
            return u.toString().replace(/\/$/, '');
        }
        catch {
            return url;
        }
    }
}
exports.SmartCrawler = SmartCrawler;
