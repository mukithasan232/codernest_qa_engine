"use strict";
/**
 * @fileoverview Global Jest setup file.
 * Runs once before all test suites begin — ideal for validating environment
 * configuration and ensuring all required env vars are present before tests start.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = globalSetup;
const dotenv_1 = __importDefault(require("dotenv"));
async function globalSetup() {
    // Load .env into process.env for all test processes
    dotenv_1.default.config();
    console.log('\n[GlobalSetup] Environment loaded. Validating required variables...');
    const REQUIRED_VARS = ['API_BASE_URL'];
    for (const key of REQUIRED_VARS) {
        if (!process.env[key]) {
            throw new Error(`[GlobalSetup] FATAL: Required environment variable "${key}" is not set. ` +
                `Create a .env file at the project root or set it in your CI/CD pipeline secrets.`);
        }
    }
    console.log('[GlobalSetup] All required environment variables are present. ✓\n');
}
