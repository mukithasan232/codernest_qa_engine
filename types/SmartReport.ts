/**
 * @fileoverview Shared TypeScript interfaces for the Smart QA Engine report.
 * Every module produces data conforming to these types.
 */

export type IssueSeverity   = 'critical' | 'warning' | 'info' | 'pass';
export type ScanStatus      = 'idle' | 'crawling' | 'testing' | 'complete' | 'error';

/** Google Core Web Vitals rating scale. */
export type WebVitalRating  = 'good' | 'needs-improvement' | 'poor';

// ─── Crawled Page ──────────────────────────────────────────────────────────

export interface DiscoveredForm {
  readonly id:     string;
  readonly action: string;
  readonly method: string;
  readonly fields: ReadonlyArray<{
    readonly name:     string;
    readonly type:     string;
    readonly required: boolean;
    readonly hasLabel: boolean;
  }>;
}

export interface DiscoveredPage {
  readonly url:        string;
  readonly title:      string;
  readonly statusCode: number;
  readonly links:      readonly string[];
  readonly forms:      readonly DiscoveredForm[];
  readonly loadTimeMs: number;
}

// ─── Module Reports ─────────────────────────────────────────────────────────

export interface LinkIssue {
  readonly url:        string;
  readonly statusCode: number;
  readonly foundOn:    string;
  readonly severity:   IssueSeverity;
}

export interface NavigationReport {
  readonly totalLinks:  number;
  readonly brokenLinks: readonly LinkIssue[];
  readonly score:       number; // 0-100
}

export interface A11yViolation {
  readonly id:          string;
  readonly description: string;
  readonly impact:      string;
  readonly page:        string;
  readonly count:       number;
}

export interface AccessibilityReport {
  readonly violations:       readonly A11yViolation[];
  readonly totalViolations:  number;
  readonly criticalCount:    number;
  readonly score:            number;
}

/** Precise timing breakdown from the Navigation Timing API. */
export interface NavigationTiming {
  /** DNS resolution duration in ms. */
  readonly dnsLookup:        number;
  /** TCP handshake duration in ms. */
  readonly tcpConnection:    number;
  /** Time To First Byte in ms. */
  readonly ttfb:             number;
  /** Server response download time in ms. */
  readonly responseTime:     number;
  /** Time until DOM is interactive in ms. */
  readonly domInteractive:   number;
  /** DOMContentLoaded event duration in ms. */
  readonly domContentLoaded: number;
  /** Total page load time in ms. */
  readonly totalLoad:        number;
}

/** Paint timing from the Paint Timing + LCP APIs. */
export interface PaintMetrics {
  /** First Contentful Paint in ms. */
  readonly fcp:        number;
  readonly fcpRating:  WebVitalRating;
  /** Largest Contentful Paint in ms. */
  readonly lcp:        number;
  readonly lcpRating:  WebVitalRating;
}

/** Cumulative Layout Shift from the Layout Instability API. */
export interface LayoutShift {
  /** CLS score (dimensionless, lower is better). */
  readonly cls:        number;
  readonly clsRating:  WebVitalRating;
}

/** Full performance report for a single page. */
export interface PagePerf {
  readonly url:         string;
  /** Detailed Navigation Timing breakdown. */
  readonly navigation:  NavigationTiming;
  /** FCP and LCP with Good/Needs-Improvement/Poor ratings. */
  readonly paint:       PaintMetrics;
  /** CLS with rating. */
  readonly layoutShift: LayoutShift;
  /** Overall page rating derived from Core Web Vitals. */
  readonly rating:      'fast' | 'moderate' | 'slow';
  /** @deprecated Use navigation.totalLoad. Kept for backward compatibility. */
  readonly loaded:      number;
  /** @deprecated Use navigation.ttfb. Kept for backward compatibility. */
  readonly firstByte:   number;
  /** @deprecated Use navigation.domContentLoaded. */
  readonly domContentLoaded: number;
}

export interface PerformanceReport {
  readonly pages:   readonly PagePerf[];
  readonly avgLoad: number;
  readonly score:   number;
}

export interface SecurityHeader {
  readonly name:     string;
  readonly present:  boolean;
  readonly value:    string | null;
  readonly severity: IssueSeverity;
}

export interface SecurityReport {
  readonly headers:       readonly SecurityHeader[];
  readonly https:         boolean;
  readonly missingCount:  number;
  readonly score:         number;
}

export interface FormReport {
  readonly totalForms:    number;
  readonly formsWithId:   number;
  readonly unlabeledFields: number;
  readonly score:         number;
}

export interface ScreenshotRecord {
  readonly url:      string;
  readonly desktop:  string;
  readonly tablet:   string;
  readonly mobile:   string;
}

// ─── Full Smart Report ──────────────────────────────────────────────────────

export interface SmartReport {
  readonly targetUrl:    string;
  readonly timestamp:    string;
  readonly pagesScanned: number;
  readonly overallScore: number;
  readonly navigation:   NavigationReport;
  readonly accessibility:AccessibilityReport;
  readonly performance:  PerformanceReport;
  readonly security:     SecurityReport;
  readonly forms:        FormReport;
  readonly screenshots:  readonly ScreenshotRecord[];
  readonly pages:        readonly DiscoveredPage[];
}

// ─── Live Scan Progress ─────────────────────────────────────────────────────

export interface ScanProgress {
  status:       ScanStatus;
  progress:     number;        // 0–100
  step:         string;
  targetUrl:    string;
  pagesFound:   number;
  pagesTested:  number;
  startedAt:    string | null;
  completedAt:  string | null;
  report:       SmartReport | null;
  error:        string | null;
}
