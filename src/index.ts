import { loadConfig } from './config/configLoader';
import { DiagnosticPinger } from './engine/pinger';
import { Logger } from './utils/logger';

async function bootstrap() {
  try {
    const config = loadConfig();
    const pinger = new DiagnosticPinger(config);
    
    await pinger.runDiagnostics();
    
    Logger.success('\nDiagnostic phase complete.');
  } catch (error: any) {
    Logger.error(error.message);
    process.exit(1);
  }
}

bootstrap();
