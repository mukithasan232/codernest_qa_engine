import fs from 'fs';
import path from 'path';
import { PingResult } from '../engine/pinger';
import { AuditResult } from '../engine/auditor';
import { Logger } from './logger';

export class MarkdownReporter {
  /**
   * Generates a Markdown report and saves it to output/reports/
   */
  public generateReport(pingResults: PingResult[], auditResults: AuditResult[]) {
    const timestamp = Math.floor(Date.now() / 1000);
    const fileName = `audit-report-${timestamp}.md`;
    const reportsDir = path.resolve(process.cwd(), 'output', 'reports');
    
    // Ensure directory exists
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const filePath = path.join(reportsDir, fileName);

    // Calculate aggregated metrics
    const totalPings = pingResults.length;
    const passedPings = pingResults.filter(p => p.passed).length;
    const failedPings = totalPings - passedPings;
    const avgLatency = totalPings > 0 
      ? Math.round(pingResults.reduce((acc, curr) => acc + curr.latency, 0) / totalPings) 
      : 0;

    const totalAudits = auditResults.length;
    const secureAudits = auditResults.filter(a => a.isSecure).length;
    const vulnerableAudits = totalAudits - secureAudits;

    const markdown = this.buildMarkdown(
      timestamp, 
      pingResults, passedPings, failedPings, avgLatency,
      auditResults, secureAudits, vulnerableAudits
    );

    try {
      fs.writeFileSync(filePath, markdown, 'utf8');
      Logger.success(`\nReport successfully generated at: ${filePath}`);
    } catch (error: any) {
      Logger.error(`Failed to write report to ${filePath}: ${error.message}`);
    }
  }

  private buildMarkdown(
    timestamp: number,
    pingResults: PingResult[], passedPings: number, failedPings: number, avgLatency: number,
    auditResults: AuditResult[], secureAudits: number, vulnerableAudits: number
  ): string {
    const dateStr = new Date(timestamp * 1000).toLocaleString();
    
    let md = `# CoderNest QA Audit Report\n\n`;
    md += `**Date:** ${dateStr}\n\n`;
    
    md += `## 📊 Summary\n\n`;
    md += `| Metric | Result |\n`;
    md += `|---|---|\n`;
    md += `| **Diagnostic Pings** | ${passedPings}/${pingResults.length} Passed |\n`;
    md += `| **Average Latency** | ${avgLatency}ms |\n`;
    md += `| **Security Audits** | ${secureAudits}/${auditResults.length} Secure |\n`;
    md += `| **Vulnerabilities** | ${vulnerableAudits} Critical Findings |\n\n`;

    md += `## 🔌 Diagnostic Engine Results\n\n`;
    if (pingResults.length === 0) {
      md += `*No diagnostic endpoints configured.*\n\n`;
    } else {
      md += `| Method | URL | Status | Latency | Pass/Fail |\n`;
      md += `|---|---|---|---|---|\n`;
      pingResults.forEach(p => {
        const passStr = p.passed ? '✅ PASS' : '❌ FAIL';
        md += `| ${p.method} | \`${p.url}\` | ${p.status} | ${p.latency}ms | ${passStr} |\n`;
      });
      md += `\n`;
    }

    md += `## 🔒 Security Auditor Findings\n\n`;
    if (auditResults.length === 0) {
      md += `*No secure endpoints configured.*\n\n`;
    } else {
      if (vulnerableAudits > 0) {
        md += `> **⚠️ WARNING:** ${vulnerableAudits} endpoints allowed unauthorized access!\n\n`;
      }
      md += `| Method | URL | Status | Result | Notes |\n`;
      md += `|---|---|---|---|---|\n`;
      auditResults.forEach(a => {
        const resStr = a.isSecure ? '✅ SECURE' : '❌ VULNERABLE';
        md += `| ${a.method} | \`${a.url}\` | ${a.status} | **${resStr}** | ${a.message} |\n`;
      });
      md += `\n`;
    }

    md += `## 💡 Recommendations\n\n`;
    if (vulnerableAudits > 0) {
      md += `- **[CRITICAL]** Fix unauthorized access on endpoints marked as VULNERABLE. Ensure auth middleware is applied.\n`;
    }
    if (failedPings > 0) {
      md += `- **[HIGH]** Investigate the failing diagnostic endpoints (Status 4xx/5xx or timeouts).\n`;
    }
    if (avgLatency > 500) {
      md += `- **[MEDIUM]** Average latency is high (${avgLatency}ms). Consider optimizing database queries or adding caching.\n`;
    }
    if (vulnerableAudits === 0 && failedPings === 0) {
      md += `- All systems nominal. No critical action required.\n`;
    }

    return md;
  }
}
