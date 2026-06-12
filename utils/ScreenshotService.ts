/**
 * @fileoverview Screenshot Service — mocked for Vercel Serverless environment.
 */

import type { ScreenshotRecord } from '../types/SmartReport';
import { Logger } from '../core/logger';

export async function captureScreenshots(
  urls: readonly string[],
  onProgress?: (msg: string) => void
): Promise<ScreenshotRecord[]> {
  Logger.info(`ScreenshotService bypassing screenshot capture in serverless environment`);

  const records: ScreenshotRecord[] = [];
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    onProgress?.(`Screenshots disabled: skipping ${url}`);
    
    records.push({
      url,
      desktop: "Screenshots disabled in serverless environment",
      tablet:  "Screenshots disabled in serverless environment",
      mobile:  "Screenshots disabled in serverless environment",
    });
  }

  return records;
}
