import axios from 'axios';
import * as cheerio from 'cheerio';
import { Reporter, ReportData, Finding } from '../utils/reporter';
import { Analyzer } from './analyzer';

export class DynamicEngine {
  private targetUrl: string;
  private authToken?: string;
  private pathsToTest = ['/', '/admin', '/api/users', '/dashboard', '/.env'];

  constructor(targetUrl: string, authToken?: string) {
    this.targetUrl = targetUrl.replace(/\/$/, ''); // Remove trailing slash
    this.authToken = authToken;
  }

  public async runScan(): Promise<ReportData> {
    // 8-second global timeout for Vercel Serverless
    const timeoutPromise = new Promise<ReportData | null>((resolve) => {
      setTimeout(() => resolve(null), 8000);
    });

    const result = await Promise.race([this.performScan(), timeoutPromise]);

    if (!result) {
      // Timeout reached, manually generate a degraded report
      return this.generateReport([], 0, 0, 0, true);
    }
    return result;
  }

  private async performScan(): Promise<ReportData> {
    const findings: Finding[] = [];
    let passed = 0;
    let failed = 0;
    let totalChecks = 0;
    
    // Auto-discovered lists for the markdown report
    const discoveredLinks: string[] = [];
    const discoveredForms: { action: string; method: string }[] = [];

    // Initial pass: Root and common paths
    for (let i = 0; i < this.pathsToTest.length; i++) {
      const path = this.pathsToTest[i];
      const url = `${this.targetUrl}${path}`;
      const startTime = Date.now();
      totalChecks++;

      try {
        const response = await axios.get(url, {
          headers: this.authToken ? { Authorization: this.authToken } : undefined,
          validateStatus: () => true, // Resolve all
          timeout: 5000 // Fast timeout per request
        });

        const latency = Date.now() - startTime;
        const isCommonVulnerablePath = ['/admin', '/api/users', '/dashboard', '/.env'].includes(path);
        
        // Security logic
        if (isCommonVulnerablePath) {
          if (response.status === 401 || response.status === 403 || response.status === 404) {
            findings.push({ status: 'PASS', message: `Securely blocked access to ${path} (${response.status})`, latency });
            passed++;
          } else {
            findings.push({ status: 'CRITICAL', message: `Endpoint allowed unauthorized access on ${path} (${response.status})`, latency });
            failed++;
          }
        } else {
          // Standard logic
          if (response.status >= 200 && response.status < 400) {
            findings.push({ status: 'PASS', message: `Successfully reached ${path} (${response.status})`, latency });
            passed++;
          } else {
            findings.push({ status: 'FAIL', message: `Failed to reach ${path} (${response.status})`, latency });
            failed++;
          }
        }

        // Deep Analysis on Root URL (Auto-Discovery)
        if (path === '/') {
          // Security Headers
          const headers = response.headers;
          ['strict-transport-security', 'x-frame-options', 'x-content-type-options'].forEach(header => {
            totalChecks++;
            if (headers[header]) {
              findings.push({ status: 'PASS', message: `Security header ${header} is present.` });
              passed++;
            } else {
              findings.push({ status: 'WARN', message: `Missing recommended security header: ${header}` });
              failed++;
            }
          });

          // DOM Parsing (Cheerio)
          if (typeof response.data === 'string' && response.data.includes('<html')) {
            const $ = cheerio.load(response.data);
            
            // 1. SEO & A11y
            totalChecks++;
            if ($('title').length > 0 && $('title').text().trim() !== '') {
              findings.push({ status: 'PASS', message: `Document <title> is present.` });
              passed++;
            } else {
              findings.push({ status: 'WARN', message: `Document <title> is missing.` });
              failed++;
            }

            // 2. Link Auto-Discovery
            const links = new Set<string>();
            $('a[href]').each((_, el) => {
              const href = $(el).attr('href');
              if (href && href.startsWith('/') && !href.startsWith('//')) {
                links.add(href);
              }
            });
            
            const newLinks = Array.from(links).slice(0, 5); // Limit to 5 max
            for (const link of newLinks) {
              if (!this.pathsToTest.includes(link)) {
                this.pathsToTest.push(link);
                discoveredLinks.push(link);
              }
            }

            // 3. Form Detection
            $('form').each((_, el) => {
              const action = $(el).attr('action') || 'unknown';
              const method = ($(el).attr('method') || 'GET').toUpperCase();
              discoveredForms.push({ action, method });
              
              if (method === 'GET' && action.startsWith('/')) {
                if (!this.pathsToTest.includes(action)) this.pathsToTest.push(action);
              } else if (method === 'POST') {
                findings.push({ status: 'WARN', message: `Form POST action detected at ${action}. Manual review required.` });
                totalChecks++;
                failed++; // We consider manual reviews as slight dings
              }
            });
          }
        }
      } catch (error: any) {
        findings.push({ status: 'FAIL', message: `Network error reaching ${path}: ${error.message}` });
        failed++;
      }
    }

    return this.generateReport(findings, passed, failed, totalChecks, false, discoveredLinks, discoveredForms);
  }

  private generateReport(
    findings: Finding[], 
    passed: number, 
    failed: number, 
    totalChecks: number, 
    timedOut: boolean,
    discoveredLinks: string[] = [],
    discoveredForms: { action: string, method: string }[] = []
  ): ReportData {
    if (timedOut) {
      findings.unshift({ status: 'CRITICAL', message: 'Engine exceeded 8-second serverless timeout. Partial results shown.' });
      failed++;
      totalChecks++;
    }

    let severity: 'Healthy' | 'Degraded' | 'Critical' = 'Healthy';
    const criticalFails = findings.filter(f => f.status === 'CRITICAL').length;
    if (failed > 0) severity = 'Degraded';
    if (criticalFails > 0) severity = 'Critical';

    const passRatio = totalChecks > 0 ? passed / totalChecks : 0;
    let grade: 'A' | 'B' | 'C' | 'F' = 'F';
    if (passRatio >= 0.9) grade = 'A';
    else if (passRatio >= 0.8) grade = 'B';
    else if (passRatio >= 0.7) grade = 'C';

    const reportData: ReportData = {
      projectName: 'CoderNest QA Core',
      timestamp: new Date().toLocaleString(),
      totalTests: totalChecks,
      passed,
      failed,
      severity,
      grade,
      findings,
      markdownResult: ''
    };

    // Include crawler metadata for reporter to use
    (reportData as any).discoveredLinks = discoveredLinks;
    (reportData as any).discoveredForms = discoveredForms;

    reportData.markdownResult = Reporter.generateMarkdownReport(reportData);
    return reportData;
  }
}
