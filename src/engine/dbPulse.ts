import axios from 'axios';
import chalk from 'chalk';
import { QAConfig } from '../config/configLoader';
import { Logger } from '../utils/logger';

export class DBPulse {
  private config: QAConfig;

  constructor(config: QAConfig) {
    this.config = config;
  }

  /**
   * Pings the dedicated database endpoint to check for strict connectivity.
   */
  public async checkPulse(): Promise<boolean> {
    if (!this.config.databaseEndpoint) {
      Logger.warn('No databaseEndpoint configured. Skipping DB Pulse check.');
      return true; // Skip gracefully
    }

    Logger.info('\nStarting Database Pulse Check...');
    const url = `${this.config.baseUrl}${this.config.databaseEndpoint.path}`;

    try {
      const response = await axios({
        method: this.config.databaseEndpoint.method,
        url: url,
        timeout: 5000,
        validateStatus: () => true,
      });

      if (response.status === 200) {
        console.log(`${chalk.green('✔ [PASS]')} Database is strictly connected (HTTP 200).`);
        return true;
      } else {
        console.log(`${chalk.red('✖ [CRITICAL FAIL]')} Database Unreachable (HTTP ${response.status}).`);
        return false;
      }
    } catch (error: any) {
      console.log(`${chalk.red('✖ [CRITICAL FAIL]')} Database Unreachable (Network Error: ${error.message}).`);
      return false;
    }
  }
}
