"use strict";
/**
 * @fileoverview CoreUtils — shared utility class for the CoderNest QA engine.
 * Centralizes environment variable access, API header construction, and
 * Supertest agent creation to keep all test suites strictly DRY.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreUtils = void 0;
const dotenv = __importStar(require("dotenv"));
const supertest_1 = __importDefault(require("supertest"));
const logger_1 = require("@core/logger");
dotenv.config();
// ─── CoreUtils ─────────────────────────────────────────────────────────────
/**
 * Centralized utility class for environment configuration and HTTP test helpers.
 * All methods are `static` — no instantiation required.
 */
class CoreUtils {
    /**
     * Retrieves a required environment variable.
     * Throws a descriptive error if the variable is absent.
     *
     * @param key - A typed {@link EnvKey}.
     * @returns The string value of the environment variable.
     * @throws {Error} If the variable is not set.
     */
    static getEnvVar(key) {
        const value = process.env[key];
        if (!value) {
            throw new Error(`[CoreUtils] Required environment variable "${key}" is missing. ` +
                `Ensure it is defined in your .env file or CI/CD secrets.`);
        }
        return value;
    }
    /**
     * Returns a safe environment variable without throwing.
     *
     * @param key - A typed {@link EnvKey}.
     * @param fallback - Default value returned if the variable is absent.
     */
    static getEnvVarSafe(key, fallback) {
        return process.env[key] ?? fallback;
    }
    /**
     * Constructs standard HTTP headers for all API requests.
     * Automatically injects `Authorization` if `API_TOKEN` is present.
     *
     * @returns A `Record<string, string>` of HTTP headers.
     */
    static getGlobalHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
        const token = process.env['API_TOKEN'];
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            logger_1.Logger.debug('Authorization header injected from API_TOKEN.');
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
    static getSupertestAgent() {
        const baseUrl = this.getEnvVar('API_BASE_URL');
        logger_1.Logger.debug(`Creating Supertest agent for base URL: ${baseUrl}`);
        return supertest_1.default.agent(baseUrl);
    }
    /**
     * Returns the current runtime environment label.
     *
     * @returns e.g., `"development"`, `"ci"`, `"production"`.
     */
    static getEnvironmentLabel() {
        return this.getEnvVarSafe('NODE_ENV', 'development');
    }
}
exports.CoreUtils = CoreUtils;
