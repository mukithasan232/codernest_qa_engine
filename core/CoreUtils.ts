/**
 * @fileoverview CoreUtils — shared utility class for the CoderNest QA engine.
 * Centralizes environment variable access, API header construction, and
 * Supertest agent creation to keep all test suites strictly DRY.
 */

import * as dotenv from 'dotenv';
import supertest from 'supertest';
import { Logger } from '@core/logger';

dotenv.config();

// ─── Environment Variable Keys ─────────────────────────────────────────────

/** Typed union of all recognized environment variable keys. Extend as needed. */
export type EnvKey =
  | 'API_BASE_URL'
  | 'API_TOKEN'
  | 'NODE_ENV'
  | 'GOOGLE_APPLICATION_CREDENTIALS';

// ─── CoreUtils ─────────────────────────────────────────────────────────────

/**
 * Centralized utility class for environment configuration and HTTP test helpers.
 * All methods are `static` — no instantiation required.
 *
 * @example
 * ```ts
 * import { CoreUtils } from '@core/CoreUtils';
 *
 * const headers = CoreUtils.getGlobalHeaders();
 * const agent   = CoreUtils.getSupertestAgent();
 * ```
 */
export class CoreUtils {
  /**
   * Retrieves a required environment variable.
   * Throws a descriptive error if the variable is absent, preventing
   * silent misconfigurations from causing obscure test failures.
   *
   * @param key - A typed {@link EnvKey} to enforce valid variable names.
   * @returns The string value of the environment variable.
   * @throws {Error} If the variable is not set.
   */
  static getEnvVar(key: EnvKey): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(
        `[CoreUtils] Required environment variable "${key}" is missing. ` +
        `Ensure it is defined in your .env file or CI/CD secrets.`
      );
    }
    return value;
  }

  /**
   * Returns a safe environment variable without throwing.
   * Use this for optional variables that have fallback defaults.
   *
   * @param key - A typed {@link EnvKey}.
   * @param fallback - Default value returned if the variable is absent.
   * @returns The variable value, or the fallback string.
   */
  static getEnvVarSafe(key: EnvKey, fallback: string): string {
    return process.env[key] ?? fallback;
  }

  /**
   * Constructs the standard HTTP headers applied globally to all API requests.
   * Automatically injects `Authorization` if `API_TOKEN` is present in env.
   *
   * @returns A strongly-typed `Record<string, string>` of HTTP headers.
   */
  static getGlobalHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    };

    const token = process.env['API_TOKEN'];
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      Logger.debug('Authorization header injected from API_TOKEN.');
    }

    return headers;
  }

  /**
   * Creates a pre-configured Supertest `SuperAgentTest` agent bound to
   * the `API_BASE_URL` environment variable. Reuse this agent per test
   * suite to share cookies/sessions across requests.
   *
   * @returns A `SuperAgentTest` instance ready for HTTP assertions.
   * @throws {Error} If `API_BASE_URL` is not defined.
   *
   * @example
   * ```ts
   * const agent = CoreUtils.getSupertestAgent();
   * const res   = await agent.get('/health').set(CoreUtils.getGlobalHeaders());
   * expect(res.status).toBe(200);
   * ```
   */
  static getSupertestAgent(): ReturnType<typeof supertest.agent> {
    const baseUrl = this.getEnvVar('API_BASE_URL');
    Logger.debug(`Creating Supertest agent for base URL: ${baseUrl}`);
    return supertest.agent(baseUrl);
  }

  /**
   * Returns the current runtime environment label.
   * Used for tagging Firestore documents with the environment they ran in.
   *
   * @returns e.g., `"ci"`, `"development"`, `"staging"`, or `"production"`.
   */
  static getEnvironmentLabel(): string {
    return this.getEnvVarSafe('NODE_ENV', 'development');
  }
}
