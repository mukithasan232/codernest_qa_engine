/**
 * @fileoverview Screenshot Service — captures full-page screenshots of every
 * discovered page at Desktop (1280px), Tablet (768px), and Mobile (375px) viewports.
 */

import * as fs   from 'fs';
import * as path from 'path';
import { chromium } from 'playwright';
import type { ScreenshotRecord } from '../types/SmartReport';
import { Logger } from '../core/logger';

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800  },
  { name: 'tablet',  width: 768,  height: 1024 },
  { name: 'mobile',  width: 375,  height: 812  },
] as const;

const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'reports', 'screenshots');

/**
 * Takes screenshots of each URL at 3 viewports.
 *
 * @param urls - Array of page URLs to screenshot.
 * @param onProgress - Optional progress callback.
 * @returns Array of {@link ScreenshotRecord} with relative file paths.
 */
export async function captureScreenshots(
  urls: readonly string[],
  onProgress?: (msg: string) => void
): Promise<ScreenshotRecord[]> {
  Logger.info(`ScreenshotService capturing ${urls.length} pages × 3 viewports…`);
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const records: ScreenshotRecord[] = [];
  const browser = await chromium.launch({ headless: true });

  try {
    for (let i = 0; i < urls.length; i++) {
      const url   = urls[i];
      const slug  = `page-${i + 1}`;
      const paths: Record<string, string> = {};

      onProgress?.(`Screenshots: capturing ${url}`);

      const page = await browser.newPage();
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

        for (const vp of VIEWPORTS) {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          const filename = `${slug}-${vp.name}.png`;
          const filepath = path.join(SCREENSHOTS_DIR, filename);
          await page.screenshot({ path: filepath, fullPage: true });
          // Return web-accessible path
          paths[vp.name] = `/reports/screenshots/${filename}`;
        }

        records.push({
          url,
          desktop: paths['desktop'],
          tablet:  paths['tablet'],
          mobile:  paths['mobile'],
        });
      } catch (err) {
        Logger.warn(`ScreenshotService failed on ${url}: ${(err as Error).message}`);
      } finally {
        await page.close().catch(() => null);
      }
    }
  } finally {
    await browser.close().catch(() => null);
  }

  Logger.success(`ScreenshotService: ${records.length} pages captured.`);
  return records;
}
