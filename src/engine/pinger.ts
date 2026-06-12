import axios from 'axios';
import { QAConfig } from '../config/configLoader';
import { Logger } from '../utils/logger';
import chalk from 'chalk';

export class DiagnosticPinger {
  private config: QAConfig;

  constructor(config: QAConfig) {
    this.config = config;
  }

  /**
   * Iterates through the configured endpoints, makes HTTP requests,
   * measures latency, and logs the outcome in a color-coded format.
   */
  public async runDiagnostics() {
    Logger.info(`Starting Diagnostics Engine against Base URL: ${this.config.baseUrl}\n`);

    for (const endpoint of this.config.endpoints) {
      const url = `${this.config.baseUrl}${endpoint.path}`;
      const startTime = Date.now();

      try {
        const response = await axios({
          method: endpoint.method,
          url: url,
          data: endpoint.body,
          headers: {
            Authorization: this.config.authToken,
          },
          validateStatus: () => true, // Resolve on all statuses so we don't throw on 4xx/5xx natively
        });

        const latency = Date.now() - startTime;
        this.logResult(endpoint.method, url, response.status, latency);
      } catch (error: any) {
        // This only fires on absolute failures (network timeout, DNS error, etc.)
        const latency = Date.now() - startTime;
        this.logResult(endpoint.method, url, 'ERR', latency, true, error.message);
      }
    }
  }

  /**
   * Terminal output formatting helper utilizing chalk for visual clarity.
   */
  private logResult(method: string, url: string, status: number | string, latency: number, isNetworkError = false, errMsg = '') {
    const methodStr = chalk.bold(method.padEnd(6));
    
    // Status coloring
    let statusStr = status.toString().padEnd(3);
    if (typeof status === 'number') {
      if (status >= 200 && status < 300) statusStr = chalk.green(statusStr);
      else if (status >= 300 && status < 400) statusStr = chalk.blue(statusStr);
      else if (status >= 400 && status < 500) statusStr = chalk.yellow(statusStr);
      else statusStr = chalk.red(statusStr);
    } else {
      statusStr = chalk.red(statusStr);
    }
    
    // Latency coloring
    let latencyStr = `${latency}ms`.padEnd(8);
    if (latency > 500) {
      latencyStr = chalk.red(latencyStr);
    } else if (latency > 200) {
      latencyStr = chalk.yellow(latencyStr);
    } else {
      latencyStr = chalk.green(latencyStr);
    }

    const output = `${methodStr} | ${statusStr} | ${latencyStr} | ${url}`;

    if (isNetworkError) {
      console.log(chalk.red('✖ ') + output + chalk.gray(` (${errMsg})`));
    } else {
      const success = typeof status === 'number' && status < 400;
      console.log((success ? chalk.green('✔ ') : chalk.red('✖ ')) + output);
    }
  }
}
