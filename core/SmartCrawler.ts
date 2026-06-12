/**
 * @fileoverview Smart Crawler — Cheerio/Axios-based lightweight spider.
 * Discovers all pages, links, and forms within the target domain.
 * Respects a max-page limit and stays on the same origin.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { Logger } from './logger';
import type { DiscoveredPage, DiscoveredForm } from '../types/SmartReport';

export class SmartCrawler {
  private visited  = new Set<string>();
  private queue:     string[] = [];
  private baseOrigin = '';
  private readonly maxPages: number;

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
  async crawl(
    startUrl: string,
    onProgress?: (msg: string) => void
  ): Promise<DiscoveredPage[]> {
    this.baseOrigin = new URL(startUrl).origin;
    this.queue      = [this.normalise(startUrl)];
    this.visited    = new Set();
    const pages: DiscoveredPage[] = [];

    Logger.info(`SmartCrawler starting at ${startUrl} (max ${this.maxPages} pages)`);

    while (this.queue.length > 0 && pages.length < this.maxPages) {
      const url = this.queue.shift()!;
      if (this.visited.has(url)) continue;
      this.visited.add(url);

      onProgress?.(`Crawling (${pages.length + 1}/${this.maxPages}): ${url}`);
      Logger.debug(`Visiting: ${url}`);

      const start = Date.now();

      try {
        const response = await axios.get(url, {
          timeout: 5000,
          validateStatus: () => true // resolve all status codes
        });

        const statusCode = response.status;
        const loadTimeMs = Date.now() - start;
        let title = '';
        let links: string[] = [];
        let forms: DiscoveredForm[] = [];

        if (typeof response.data === 'string' && response.data.includes('<html')) {
          const $ = cheerio.load(response.data);
          title = $('title').text().trim() || '';

          // ── Discover same-domain links ──────────────────────────────────
          links = this.discoverLinks($, url);
          for (const link of links) {
            if (!this.visited.has(link) && !this.queue.includes(link)) {
              this.queue.push(link);
            }
          }

          // ── Discover forms ──────────────────────────────────────────────
          forms = this.discoverForms($);
        }

        pages.push({ url, title, statusCode, links, forms, loadTimeMs });
      } catch (err: any) {
        Logger.warn(`Failed to crawl ${url}: ${err.message}`);
        pages.push({
          url, title: 'Error', statusCode: 0,
          links: [], forms: [], loadTimeMs: Date.now() - start,
        });
      }
    }

    Logger.success(`Crawl complete — ${pages.length} pages discovered.`);
    return pages;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private discoverLinks($: cheerio.CheerioAPI, currentUrl: string): string[] {
    const hrefs: string[] = [];
    $('a[href]').each((_, el) => {
      let href = $(el).attr('href');
      if (!href) return;
      try {
        if (href.startsWith('/')) {
          href = this.baseOrigin + href;
        } else if (!href.startsWith('http')) {
          href = new URL(href, currentUrl).toString();
        }
        hrefs.push(href);
      } catch {
        // ignore invalid urls
      }
    });

    return [...new Set(
      hrefs
        .filter((h) => h.startsWith(this.baseOrigin))
        .map((h) => this.normalise(h))
    )];
  }

  private discoverForms($: cheerio.CheerioAPI): DiscoveredForm[] {
    const forms: DiscoveredForm[] = [];
    $('form').each((i, el) => {
      const id = $(el).attr('id') || `form-${i}`;
      const action = $(el).attr('action') || '';
      const method = ($(el).attr('method') || 'get').toUpperCase();
      
      const fields: any[] = [];
      $(el).find('input, select, textare').each((_, inputEl) => {
        const inputName = $(inputEl).attr('name') || $(inputEl).attr('id') || '';
        const inputType = $(inputEl).attr('type') || inputEl.tagName.toLowerCase();
        const required = typeof $(inputEl).attr('required') !== 'undefined';
        const hasLabel = !!$(inputEl).attr('id') && $(`label[for="${$(inputEl).attr('id')}"]`).length > 0;
        
        fields.push({
          name: inputName,
          type: inputType,
          required,
          hasLabel
        });
      });

      forms.push({ id, action, method, fields });
    });
    return forms;
  }

  /** Strips hash fragments and trailing slashes for deduplication. */
  private normalise(url: string): string {
    try {
      const u = new URL(url);
      u.hash = '';
      return u.toString().replace(/\/$/, '');
    } catch {
      return url;
    }
  }
}
