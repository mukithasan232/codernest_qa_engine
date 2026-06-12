/**
 * @fileoverview Security Audit — checks HTTP response headers for security best practices.
 * Makes a single HEAD/GET request per URL — no browser required.
 */

import * as https from 'https';
import * as http  from 'http';
import type { SecurityReport, SecurityHeader, IssueSeverity } from '../types/SmartReport';
import { Logger } from '../core/logger';

// ── Required security headers and their expected values ────────────────────

interface HeaderSpec {
  name:     string;
  severity: IssueSeverity;
  hint:     string;
}

const REQUIRED_HEADERS: HeaderSpec[] = [
  { name: 'strict-transport-security', severity: 'critical', hint: 'Enable HSTS to enforce HTTPS.' },
  { name: 'content-security-policy',   severity: 'critical', hint: 'Add a CSP to prevent XSS attacks.' },
  { name: 'x-frame-options',           severity: 'warning',  hint: 'Prevents clickjacking attacks.' },
  { name: 'x-content-type-options',    severity: 'warning',  hint: 'Set to "nosniff" to prevent MIME sniffing.' },
  { name: 'referrer-policy',           severity: 'info',     hint: 'Controls referrer information.' },
  { name: 'permissions-policy',        severity: 'info',     hint: 'Restricts browser feature access.' },
];

/**
 * Fetches response headers for a given URL and audits security posture.
 *
 * @param targetUrl - The root URL to audit.
 * @returns A typed {@link SecurityReport}.
 */
export async function runSecurityAudit(targetUrl: string): Promise<SecurityReport> {
  Logger.info(`SecurityAudit scanning: ${targetUrl}`);

  let responseHeaders: Record<string, string> = {};
  const isHttps = targetUrl.startsWith('https://');

  try {
    responseHeaders = await fetchHeaders(targetUrl);
  } catch (err) {
    Logger.warn(`SecurityAudit could not fetch headers: ${(err as Error).message}`);
  }

  const headers: SecurityHeader[] = REQUIRED_HEADERS.map((spec) => {
    const rawValue = responseHeaders[spec.name] ?? null;
    return {
      name:     spec.name,
      present:  rawValue !== null,
      value:    rawValue,
      severity: rawValue ? 'pass' : spec.severity,
    };
  });

  const missingCount = headers.filter((h) => !h.present).length;
  const criticals    = headers.filter((h) => !h.present && h.severity === 'critical').length;
  const score        = Math.max(0, Math.round(100 - criticals * 25 - (missingCount - criticals) * 10));

  return { headers, https: isHttps, missingCount, score };
}

// ── Helper ─────────────────────────────────────────────────────────────────

function fetchHeaders(url: string): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: 'GET' }, (res) => {
      const headers: Record<string, string> = {};
      for (const [key, val] of Object.entries(res.headers)) {
        if (val) headers[key.toLowerCase()] = Array.isArray(val) ? val[0] : val;
      }
      res.resume(); // drain
      resolve(headers);
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}
