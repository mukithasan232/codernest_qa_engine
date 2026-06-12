"use strict";
/**
 * @fileoverview Screenshot Service — captures full-page screenshots of every
 * discovered page at Desktop (1280px), Tablet (768px), and Mobile (375px) viewports.
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
exports.captureScreenshots = captureScreenshots;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const playwright_1 = require("playwright");
const logger_1 = require("@core/logger");
const VIEWPORTS = [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 812 },
];
const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'reports', 'screenshots');
/**
 * Takes screenshots of each URL at 3 viewports.
 *
 * @param urls - Array of page URLs to screenshot.
 * @param onProgress - Optional progress callback.
 * @returns Array of {@link ScreenshotRecord} with relative file paths.
 */
async function captureScreenshots(urls, onProgress) {
    logger_1.Logger.info(`ScreenshotService capturing ${urls.length} pages × 3 viewports…`);
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    const records = [];
    const browser = await playwright_1.chromium.launch({ headless: true });
    try {
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            const slug = `page-${i + 1}`;
            const paths = {};
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
                    tablet: paths['tablet'],
                    mobile: paths['mobile'],
                });
            }
            catch (err) {
                logger_1.Logger.warn(`ScreenshotService failed on ${url}: ${err.message}`);
            }
            finally {
                await page.close().catch(() => null);
            }
        }
    }
    finally {
        await browser.close().catch(() => null);
    }
    logger_1.Logger.success(`ScreenshotService: ${records.length} pages captured.`);
    return records;
}
