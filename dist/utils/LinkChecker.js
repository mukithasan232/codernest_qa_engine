"use strict";
/**
 * @fileoverview Link Checker — validates all discovered links for broken URLs.
 * Uses Node.js http/https (no browser) for lightweight parallel checks.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.runLinkChecker = runLinkChecker;
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const logger_1 = require("@core/logger");
/**
 * Checks the HTTP status of a URL with a timeout.
 */
function checkUrl(url) {
    return new Promise((resolve) => {
        try {
            const lib = url.startsWith('https') ? https : http;
            const req = lib.request(url, { method: 'HEAD' }, (res) => {
                resolve(res.statusCode ?? 0);
                res.resume();
            });
            req.on('error', () => resolve(0));
            req.setTimeout(8000, () => { req.destroy(); resolve(0); });
            req.end();
        }
        catch {
            resolve(0);
        }
    });
}
/**
 * Checks all discovered links across crawled pages and generates a navigation report.
 *
 * @param pages - Array of `{ url, links }` objects from the SmartCrawler.
 * @returns A typed {@link NavigationReport}.
 */
async function runLinkChecker(pages) {
    logger_1.Logger.info('LinkChecker scanning all discovered links…');
    // Collect all unique links with their source page
    const linkMap = new Map(); // url → foundOn
    for (const page of pages) {
        for (const link of page.links) {
            if (!linkMap.has(link))
                linkMap.set(link, page.url);
        }
    }
    const allLinks = [...linkMap.entries()];
    logger_1.Logger.info(`LinkChecker checking ${allLinks.length} unique links…`);
    // Check all links in parallel (batches of 10)
    const brokenLinks = [];
    const BATCH = 10;
    for (let i = 0; i < allLinks.length; i += BATCH) {
        const batch = allLinks.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(async ([url, foundOn]) => {
            const statusCode = await checkUrl(url);
            return { url, statusCode, foundOn };
        }));
        for (const { url, statusCode, foundOn } of results) {
            if (statusCode === 0 || statusCode >= 400) {
                brokenLinks.push({
                    url,
                    statusCode,
                    foundOn,
                    severity: statusCode >= 500 || statusCode === 0 ? 'critical' : 'warning',
                });
            }
        }
    }
    const score = allLinks.length === 0
        ? 100
        : Math.max(0, Math.round(100 - (brokenLinks.length / allLinks.length) * 100));
    logger_1.Logger.info(`LinkChecker: ${brokenLinks.length} broken out of ${allLinks.length} links. Score: ${score}`);
    return { totalLinks: allLinks.length, brokenLinks, score };
}
