import { parseEnv } from "#config/env.js";

const secret = (label) => `${label}-`.padEnd(48, "z");

const COMMON = {
    MONGODB_URI: "mongodb://127.0.0.1:27017/SamarthAITest",
    ACCESS_TOKEN_SECRET: secret("helper-access"),
    REFRESH_TOKEN_SECRET: secret("helper-refresh"),
    IDENTIFIER_HASH_SECRET: secret("helper-identifier"),
};

const BASES = {
    test: { NODE_ENV: "test" },
    development: {
        ...COMMON,
        NODE_ENV: "development",
        FRONTEND_URL: "http://localhost:5173",
        CORS_ALLOWED_ORIGINS: "http://localhost:5173",
        LOG_LEVEL: "silent",
    },
    production: {
        ...COMMON,
        NODE_ENV: "production",
        FRONTEND_URL: "https://app.example.test",
        CORS_ALLOWED_ORIGINS: "https://app.example.test",
        EMAIL_TRANSPORT: "log",
        CLOUDINARY_CLOUD_NAME: "test-cloud",
        CLOUDINARY_API_KEY: "test-key",
        CLOUDINARY_API_SECRET: secret("helper-cloudinary"),
        GOOGLE_CLIENT_ID: "test-client-id",
        LOG_LEVEL: "silent",
    },
};

/**
 * Builds a validated config for a unit test by running the real parser, so a test can never use an invalid combination.
 * `overrides` are raw env names (e.g. `{ NODE_ENV: "production", COOKIE_SAMESITE: "none" }`); `undefined` removes a key.
 */
export function makeTestEnv(overrides = {}) {
    const base = BASES[overrides.NODE_ENV ?? "test"];
    return parseEnv({ ...base, ...overrides });
}
