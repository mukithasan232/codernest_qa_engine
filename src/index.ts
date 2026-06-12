import { loadConfig } from './config/configLoader';
import { DiagnosticPinger } from './engine/pinger';
import { SecurityAuditor } from './engine/auditor';
import { DBPulse } from './engine/dbPulse';
import { MarkdownReporter } from './utils/reporter';
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
    await dbPulse.checkPulse();
    
    // Phase 3b: Report Generation
    const reporter = new MarkdownReporter();
    reporter.generateReport(pingResults, auditResults);
    
    Logger.success('\nCoderNest QA Engine Execution Complete.');
  } catch (error: any) {
    Logger.error(error.message);
    process.exit(1);
  }
}

bootstrap();
