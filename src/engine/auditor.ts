import axios from 'axios';
import { QAConfig } from '../config/configLoader';
import { Logger } from '../utils/logger';
import chalk from 'chalk';

export interface AuditResult {
  url: string;
  method: string;
  status: number | string;
  isSecure: boolean;
  message: string;
}

export class SecurityAuditor {
  private config: QAConfig;

  constructor(config: QAConfig) {
    this.config = config;
  }

  /**
   * Tests secure endpoints without an auth token to ensure they are protected.
   * Expects 401 or 403. Anything else (200, 500) is marked as a vulnerability.
   */
  public async runAudit(): Promise<AuditResult[]> {
    Logger.info(`\nStarting Security Auditor against ${this.config.secureEndpoints.length} endpoints...`);
    
    const results: AuditResult[] = [];

    for (const endpoint of this.config.secureEndpoints) {
      const url = `${this.config.baseUrl}${endpoint.path}`;
      
      try {
        const response = await axios({
          method: endpoint.method,
          url: url,
          data: endpoint.body,
          // Explicitly omit Authorization header
          validateStatus: () => true,
        });

        const status = response.status;
        const isSecure = status === 401 || status === 403;
        
        let message = '';
        if (isSecure) {
          message = `Correctly rejected unauthorized access with ${status}`;
          this.logResult(endpoint.method, url, status, true, message);
        } else {
          message = `VULNERABILITY: Endpoint allowed unauthorized access or leaked data (Status: ${status})`;
          this.logResult(endpoint.method, url, status, false, message);
        }

        results.push({ url, method: endpoint.method, status, isSecure, message });

      } catch (error: any) {
        const message = `ERR: Network failure during audit - ${error.message}`;
        this.logResult(endpoint.method, url, 'ERR', false, message);
        results.push({ url, method: endpoint.method, status: 'ERR', isSecure: false, message });
      }
    }

    return results;
  }

  private logResult(method: string, url: string, status: number | string, isSecure: boolean, message: string) {
    const methodStr = chalk.bold(method.padEnd(6));
    const urlStr = url.padEnd(45);
    
    if (isSecure) {
      console.log(`${chalk.green('✔ [PASS]')} ${methodStr} | ${urlStr} | ${chalk.green(status)}`);
    } else {
      console.log(`${chalk.red('✖ [CRITICAL FAIL]')} ${methodStr} | ${urlStr} | ${chalk.red(status)}`);
      console.log(chalk.red(`  ↳ ${message}`));
    }
  }
}
