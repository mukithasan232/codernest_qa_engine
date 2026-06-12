/**
 * @fileoverview Link Checker — validates all discovered links for broken URLs.
 * Uses Node.js http/https (no browser) for lightweight parallel checks.
 */

import * as https from 'https';
import * as http  from 'http';
import type { LinkIssue, NavigationReport } from '../types/SmartReport';
import { Logger } from '@core/logger';

/**
 * Checks the HTTP status of a URL with a timeout.
 */
function checkUrl(url: string): Promise<number> {
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
    } catch {
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
export async function runLinkChecker(
  pages: ReadonlyArray<{ url: string; links: readonly string[] }>
): Promise<NavigationReport> {
  Logger.info('LinkChecker scanning all discovered links…');

  // Collect all unique links with their source page
  const linkMap = new Map<string, string>(); // url → foundOn
  for (const page of pages) {
    for (const link of page.links) {
      if (!linkMap.has(link)) linkMap.set(link, page.url);
    }
  }

  const allLinks = [...linkMap.entries()];
  Logger.info(`LinkChecker checking ${allLinks.length} unique links…`);

  // Check all links in parallel (batches of 10)
  const brokenLinks: LinkIssue[] = [];
  const BATCH = 10;

  for (let i = 0; i < allLinks.length; i += BATCH) {
    const batch = allLinks.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async ([url, foundOn]) => {
        const statusCode = await checkUrl(url);
        return { url, statusCode, foundOn };
      })
    );

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

  Logger.info(`LinkChecker: ${brokenLinks.length} broken out of ${allLinks.length} links. Score: ${score}`);
  return { totalLinks: allLinks.length, brokenLinks, score };
}
