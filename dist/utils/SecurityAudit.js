"use strict";
/**
 * @fileoverview Security Audit — checks HTTP response headers for security best practices.
 * Makes a single HEAD/GET request per URL — no browser required.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSecurityAudit = runSecurityAudit;
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const logger_1 = require("@core/logger");
const REQUIRED_HEADERS = [
    { name: 'strict-transport-security', severity: 'critical', hint: 'Enable HSTS to enforce HTTPS.' },
    { name: 'content-security-policy', severity: 'critical', hint: 'Add a CSP to prevent XSS attacks.' },
    { name: 'x-frame-options', severity: 'warning', hint: 'Prevents clickjacking attacks.' },
    { name: 'x-content-type-options', severity: 'warning', hint: 'Set to "nosniff" to prevent MIME sniffing.' },
    { name: 'referrer-policy', severity: 'info', hint: 'Controls referrer information.' },
    { name: 'permissions-policy', severity: 'info', hint: 'Restricts browser feature access.' },
];
/**
 * Fetches response headers for a given URL and audits security posture.
 *
 * @param targetUrl - The root URL to audit.
 * @returns A typed {@link SecurityReport}.
 */
async function runSecurityAudit(targetUrl) {
    logger_1.Logger.info(`SecurityAudit scanning: ${targetUrl}`);
    let responseHeaders = {};
    const isHttps = targetUrl.startsWith('https://');
    try {
        responseHeaders = await fetchHeaders(targetUrl);
    }
    catch (err) {
        logger_1.Logger.warn(`SecurityAudit could not fetch headers: ${err.message}`);
    }
    const headers = REQUIRED_HEADERS.map((spec) => {
        const rawValue = responseHeaders[spec.name] ?? null;
        return {
            name: spec.name,
            present: rawValue !== null,
            value: rawValue,
            severity: rawValue ? 'pass' : spec.severity,
        };
    });
    const missingCount = headers.filter((h) => !h.present).length;
    const criticals = headers.filter((h) => !h.present && h.severity === 'critical').length;
    const score = Math.max(0, Math.round(100 - criticals * 25 - (missingCount - criticals) * 10));
    return { headers, https: isHttps, missingCount, score };
}
// ── Helper ─────────────────────────────────────────────────────────────────
function fetchHeaders(url) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        const req = lib.request(url, { method: 'GET' }, (res) => {
            const headers = {};
            for (const [key, val] of Object.entries(res.headers)) {
                if (val)
                    headers[key.toLowerCase()] = Array.isArray(val) ? val[0] : val;
            }
            res.resume(); // drain
            resolve(headers);
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}
