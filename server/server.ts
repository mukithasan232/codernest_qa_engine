/**
 * @fileoverview Server entry point. Imports the Express `app` and calls `.listen()`.
 * This file is used ONLY for `npm run dev` — tests import `app.ts` directly.
 */

import * as dotenv from 'dotenv';
import app from './app';
import { Logger } from '../core/logger';

dotenv.config();

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);

app.listen(PORT, () => {
  Logger.success(`════════════════════════════════════════════`);
  Logger.success(` CoderNest QA Core API — Dev Server Ready`);
  Logger.success(` Listening on: http://localhost:${PORT}`);
  Logger.success(` Environment : ${process.env['NODE_ENV'] ?? 'development'}`);
  Logger.success(`════════════════════════════════════════════`);
});
