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
    const findings: Finding[] = [];
    let passed = 0;
    let failed = 0;
    let totalChecks = 0;

    for (const path of this.pathsToTest) {
      const url = `${this.targetUrl}${path}`;
      const startTime = Date.now();
      totalChecks++;

      try {
        const response = await axios.get(url, {
          headers: this.authToken ? { Authorization: this.authToken } : undefined,
          validateStatus: () => true, // Resolve all
          timeout: 10000
        });

        const latency = Date.now() - startTime;
        const isCommonVulnerablePath = path !== '/' && path !== '/dashboard';
        
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

        // Deep Analysis on Root URL
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

          // SEO & A11y (Cheerio)
          if (typeof response.data === 'string' && response.data.includes('<html')) {
            const $ = cheerio.load(response.data);
            
            totalChecks++;
            if ($('title').length > 0 && $('title').text().trim() !== '') {
              findings.push({ status: 'PASS', message: `Document <title> is present.` });
              passed++;
            } else {
              findings.push({ status: 'WARN', message: `Document <title> is missing.` });
              failed++;
            }

            totalChecks++;
            if ($('meta[name="description"]').length > 0) {
              findings.push({ status: 'PASS', message: `Meta description is present.` });
              passed++;
            } else {
              findings.push({ status: 'WARN', message: `Meta description is missing.` });
              failed++;
            }

            totalChecks++;
            if ($('h1').length > 0) {
              findings.push({ status: 'PASS', message: `Primary <h1> tag is present.` });
              passed++;
            } else {
              findings.push({ status: 'WARN', message: `Primary <h1> tag is missing.` });
              failed++;
            }
          }
        }
      } catch (error: any) {
        findings.push({ status: 'FAIL', message: `Network error reaching ${path}: ${error.message}` });
        failed++;
      }
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

    // Generate markdown
    reportData.markdownResult = Reporter.generateMarkdownReport(reportData);

    return reportData;
  }
}
