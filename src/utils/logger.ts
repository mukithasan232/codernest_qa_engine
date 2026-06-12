import chalk from 'chalk';

export const Logger = {
  success: (msg: string) => console.log(chalk.green(`[SUCCESS] ${msg}`)),
  error: (msg: string) => console.log(chalk.red(`[ERROR] ${msg}`)),
  warn: (msg: string) => console.log(chalk.yellow(`[WARN] ${msg}`)),
  info: (msg: string) => console.log(chalk.blue(`[INFO] ${msg}`)),
};
