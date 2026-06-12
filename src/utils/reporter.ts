import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { Logger } from './logger';

export interface Finding {
  status: string; // 'PASS' | 'FAIL' | 'CRITICAL' | 'WARN'
  message: string;
  latency?: number;
}

export interface ReportData {
  projectName: string;
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  severity: 'Healthy' | 'Degraded' | 'Critical';
  findings: Finding[];
}

export const Reporter = {
  /**
   * Generates a professionally formatted Markdown string from the ReportData.
   */
  generateMarkdownReport(data: ReportData): string {
    let md = `# 🚀 CoderNest QA Audit Report\n\n`;
    
    // Summary Section
    md += `## 📊 Summary\n`;
    md += `- **Project**: ${data.projectName}\n`;
    md += `- **Date**: ${data.timestamp}\n`;
    
    const severityEmoji = data.severity === 'Healthy' ? '✅' : (data.severity === 'Degraded' ? '⚠️' : '❌');
    md += `- **Status**: ${severityEmoji} ${data.severity}\n`;
    md += `- **Tests Passed**: ${data.passed} / ${data.totalTests}\n\n`;

    // Findings Section
    const criticalFindings = data.findings.filter(f => f.status === 'CRITICAL' || f.status === 'FAIL');
    const normalFindings = data.findings.filter(f => f.status === 'PASS' || f.status === 'WARN');

    if (criticalFindings.length > 0) {
      md += `## ❌ Critical Findings\n`;
      md += `| Status | Message | Latency |\n`;
      md += `|---|---|---|\n`;
      criticalFindings.forEach(f => {
        md += `| **${f.status}** | ${f.message} | ${f.latency ? f.latency + 'ms' : '-'} |\n`;
      });
      md += `\n`;
    }

    md += `## ✅ Test Results\n`;
    md += `| Status | Message | Latency |\n`;
    md += `|---|---|---|\n`;
    normalFindings.forEach(f => {
      md += `| **${f.status}** | ${f.message} | ${f.latency ? f.latency + 'ms' : '-'} |\n`;
    });

    return md;
  },

  /**
   * Saves the generated markdown to the local output/reports directory.
   * Handles read-only file systems gracefully (e.g., Vercel serverless).
   */
  saveReportToFile(markdownString: string): string | null {
    if (process.env.VERCEL === '1') {
      Logger.warn('[WARN] Running in Vercel Serverless Environment. Bypassing local file write.');
      return null;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const fileName = `codernest-audit-${timestamp}.md`;
    const reportsDir = path.resolve(process.cwd(), 'output', 'reports');
    const filePath = path.join(reportsDir, fileName);

    try {
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      fs.writeFileSync(filePath, markdownString, 'utf8');
      return filePath;
    } catch (error: any) {
      Logger.warn(`Failed to save report to file system (possibly read-only environment like Vercel).`);
      Logger.warn(`Details: ${error.message}`);
      return null;
    }
  }
};
