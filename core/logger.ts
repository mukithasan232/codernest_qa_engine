/**
 * @fileoverview Structured, leveled logger for the CoderNest QA Core engine.
 * Outputs colorized, timestamped log entries to the console.
 * Zero external dependencies — uses only Node.js built-ins.
 */

/** ANSI color codes for terminal output. */
const Colors = {
  reset:  '\x1b[0m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  white:  '\x1b[37m',
} as const;

/** Supported log levels. */
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | 'DEBUG';

/**
 * Formats the current date/time as an ISO timestamp string.
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Maps a log level to its corresponding ANSI color code.
 */
function getLevelColor(level: LogLevel): string {
  switch (level) {
    case 'INFO':    return Colors.cyan;
    case 'WARN':    return Colors.yellow;
    case 'ERROR':   return Colors.red;
    case 'SUCCESS': return Colors.green;
    case 'DEBUG':   return Colors.dim;
  }
}

/**
 * Core logger utility for the QA engine. Provides structured,
 * colorized console output with timestamps and log levels.
 *
 * @example
 * ```ts
 * import { Logger } from '@core/logger';
 * Logger.info('Test suite started');
 * Logger.success('All tests passed');
 * Logger.error('Connection to Firebase failed', err);
 * ```
 */
export class Logger {
  private static format(level: LogLevel, message: string): string {
    const color = getLevelColor(level);
    const ts = `${Colors.dim}${getTimestamp()}${Colors.reset}`;
    const tag = `${color}[${level.padEnd(7)}]${Colors.reset}`;
    return `${ts} ${tag} ${message}`;
  }

  /** Logs an informational message. */
  static info(message: string): void {
    console.log(this.format('INFO', message));
  }

  /** Logs a warning message. */
  static warn(message: string): void {
    console.warn(this.format('WARN', message));
  }

  /** Logs an error message, optionally with an Error object. */
  static error(message: string, error?: unknown): void {
    console.error(this.format('ERROR', message));
    if (error instanceof Error) {
      console.error(`${Colors.dim}  → ${error.message}${Colors.reset}`);
    }
  }

  /** Logs a success message (e.g., test suite passed). */
  static success(message: string): void {
    console.log(this.format('SUCCESS', message));
  }

  /** Logs a debug message. Only shown if NODE_ENV=development. */
  static debug(message: string): void {
    if (process.env['NODE_ENV'] === 'development') {
      console.log(this.format('DEBUG', message));
    }
  }
}
