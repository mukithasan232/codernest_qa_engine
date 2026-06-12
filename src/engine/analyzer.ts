import chalk from 'chalk';

export type LatencyStatus = 'Excellent' | 'Acceptable' | 'Poor/Degraded';

export const Analyzer = {
  /**
   * Evaluates the latency of a request and classifies it.
   */
  evaluateLatency(latencyMs: number): LatencyStatus {
    if (latencyMs < 300) return 'Excellent';
    if (latencyMs <= 800) return 'Acceptable';
    return 'Poor/Degraded';
  },

  /**
   * Returns a chalk-colored string of the latency status.
   */
  colorLatencyStatus(status: LatencyStatus): string {
    switch (status) {
      case 'Excellent':
        return chalk.green(status);
      case 'Acceptable':
        return chalk.yellow(status);
      case 'Poor/Degraded':
        return chalk.red(status);
      default:
        return status;
    }
  }
};
