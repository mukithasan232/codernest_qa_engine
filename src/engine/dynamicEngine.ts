import axios from 'axios';
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

    for (const path of this.pathsToTest) {
      const url = `${this.targetUrl}${path}`;
      const startTime = Date.now();

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
      } catch (error: any) {
        findings.push({ status: 'FAIL', message: `Network error reaching ${path}: ${error.message}` });
        failed++;
      }
    }

    const totalTests = this.pathsToTest.length;
    let severity: 'Healthy' | 'Degraded' | 'Critical' = 'Healthy';
    if (failed > 0) severity = failed > 2 ? 'Critical' : 'Degraded';

    const reportData: ReportData = {
      projectName: 'CoderNest QA Core',
      timestamp: new Date().toLocaleString(),
      totalTests,
      passed,
      failed,
      severity,
      findings,
      markdownResult: ''
    };

    // Generate markdown
    reportData.markdownResult = Reporter.generateMarkdownReport(reportData);

    return reportData;
  }
}
