import chalk from 'chalk';
import { loadConfig } from './config/configLoader';
import { DiagnosticPinger } from './engine/pinger';
import { SecurityAuditor } from './engine/auditor';
import { DBPulse } from './engine/dbPulse';
import { Reporter } from './utils/reporter';
import { Logger } from './utils/logger';

async function bootstrap() {
  try {
    const config = loadConfig();
    
    // Phase 1 & 2: Diagnostic Pinger (processed by Analyzer internally)
    const pinger = new DiagnosticPinger(config);
    const pingResults = await pinger.runDiagnostics();
    
    // Phase 3a: Security Auditor
    const auditor = new SecurityAuditor(config);
    const auditResults = await auditor.runAudit();

    // Phase 3c: Database Pulse
    const dbPulse = new DBPulse(config);
    const dbPulseOk = await dbPulse.checkPulse();
    
    // Phase 3b: Report Generation
    const totalTests = pingResults.length + auditResults.length + 1; // +1 for DB Pulse
    const passed = pingResults.filter(p => p.passed).length + auditResults.filter(a => a.isSecure).length + (dbPulseOk ? 1 : 0);
    const failed = totalTests - passed;
    
    let severity: 'Healthy' | 'Degraded' | 'Critical' = 'Healthy';
    if (failed > 0) severity = failed > 2 ? 'Critical' : 'Degraded';

    const findings = [
      ...pingResults.map(p => ({
        status: p.passed ? 'PASS' : 'FAIL',
        message: `${p.method} ${p.url} [${p.status}]`,
        latency: p.latency
      })),
      ...auditResults.map(a => ({
        status: a.isSecure ? 'PASS' : 'CRITICAL',
        message: a.message,
      })),
      {
        status: dbPulseOk ? 'PASS' : 'CRITICAL',
        message: dbPulseOk ? 'Database is correctly connected.' : 'Database Unreachable.'
      }
    ];

    const reportData = {
      projectName: 'CoderNest QA Core',
      timestamp: new Date().toLocaleString(),
      totalTests,
      passed,
      failed,
      severity,
      findings
    };

    const markdownStr = Reporter.generateMarkdownReport(reportData);
    const savedPath = Reporter.saveReportToFile(markdownStr);
    
    if (savedPath) {
      console.log(chalk.bgGreen.black(`\n ✔ REPORT SAVED: ${savedPath} `));
    }

    Logger.success('\nCoderNest QA Engine Execution Complete.');
  } catch (error: any) {
    Logger.error(error.message);
    process.exit(1);
  }
}

bootstrap();
