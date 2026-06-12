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
  | 'PORT';

// ─── CoreUtils ─────────────────────────────────────────────────────────────

/**
 * Centralized utility class for environment configuration and HTTP test helpers.
 * All methods are `static` — no instantiation required.
 */
export class CoreUtils {
  /**
   * Retrieves a required environment variable.
   * Throws a descriptive error if the variable is absent.
   *
   * @param key - A typed {@link EnvKey}.
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
   *
   * @param key - A typed {@link EnvKey}.
   * @param fallback - Default value returned if the variable is absent.
   */
  static getEnvVarSafe(key: EnvKey, fallback: string): string {
    return process.env[key] ?? fallback;
  }

  /**
   * Constructs standard HTTP headers for all API requests.
   * Automatically injects `Authorization` if `API_TOKEN` is present.
   *
   * @returns A `Record<string, string>` of HTTP headers.
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
   * Creates a Supertest agent bound to `API_BASE_URL`.
   * Use this when testing against a live/staging URL rather than the app instance.
   *
   * @returns A Supertest agent instance.
   * @throws {Error} If `API_BASE_URL` is not defined.
   */
  static getSupertestAgent(): ReturnType<typeof supertest.agent> {
    const baseUrl = this.getEnvVar('API_BASE_URL');
    Logger.debug(`Creating Supertest agent for base URL: ${baseUrl}`);
    return supertest.agent(baseUrl);
  }

  /**
   * Returns the current runtime environment label.
   *
   * @returns e.g., `"development"`, `"ci"`, `"production"`.
   */
  static getEnvironmentLabel(): string {
    return this.getEnvVarSafe('NODE_ENV', 'development');
  }
}
