import pino from "pino";
import { env } from "#config/env.js";

const SENSITIVE_KEYS = [
    "password",
    "newPassword",
    "currentPassword",
    "passwordHash",
    "token",
    "accessToken",
    "refreshToken",
    "credential",
    "authorization",
    "cookie",
    "cookies",
    "otp",
    "apiKey",
    "apiSecret",
    "secret",
    "csrfToken",
];

/** Redaction list (BE-27, AUTH-24): sensitive keys at the top level and up to two levels deep, plus request/response headers. */
export const REDACT_PATHS = Object.freeze([
    ...SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`]),
    "req.headers.authorization",
    "req.headers.cookie",
    'req.headers["x-csrf-token"]',
    "res.headers.*",
]);

/** Builds a pino logger. Pretty output only in development; `destination` lets tests capture lines. */
export function createLogger({
    level = env.logLevel,
    isDevelopment = env.isDevelopment,
    destination,
} = {}) {
    const options = {
        level,
        base: { service: "samarth-ai-api" },
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: { level: (label) => ({ level: label }) },
        redact: { paths: [...REDACT_PATHS], censor: "[Redacted]" },
    };
    if (isDevelopment && !destination) {
        options.transport = {
            target: "pino-pretty",
            options: { colorize: true, translateTime: "SYS:standard" },
        };
    }
    return destination ? pino(options, destination) : pino(options);
}

export const logger = createLogger();
