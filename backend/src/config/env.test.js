import { describe, expect, it } from "vitest";
import { env, EnvValidationError, parseEnv } from "./env.js";

const secret = (label) => `${label}-`.padEnd(40, "q");
const devEnv = (overrides = {}) => ({
    NODE_ENV: "development",
    FRONTEND_URL: "http://localhost:5173",
    CORS_ALLOWED_ORIGINS: "http://localhost:5173",
    MONGODB_URI: "mongodb://127.0.0.1:27017/SamarthAI",
    ACCESS_TOKEN_SECRET: secret("a"),
    REFRESH_TOKEN_SECRET: secret("b"),
    IDENTIFIER_HASH_SECRET: secret("c"),
    ...overrides,
});
const prodEnv = (overrides = {}) =>
    devEnv({
        NODE_ENV: "production",
        FRONTEND_URL: "https://app.example.test",
        CORS_ALLOWED_ORIGINS: "https://app.example.test",
        EMAIL_TRANSPORT: "brevo",
        BREVO_API_KEY: "placeholder-brevo",
        EMAIL_FROM_ADDRESS: "no-reply@example.test",
        CLOUDINARY_CLOUD_NAME: "cloud",
        CLOUDINARY_API_KEY: "key",
        CLOUDINARY_API_SECRET: "cloud-secret",
        GOOGLE_CLIENT_ID: "client-id",
        ...overrides,
    });
const issuesOf = (raw) => {
    try {
        parseEnv(raw);
    } catch (error) {
        expect(error).toBeInstanceOf(EnvValidationError);
        return error.issues.join("\n");
    }
    return "";
};

describe("parseEnv: valid configuration", () => {
    it("builds a frozen, typed development config with documented defaults", () => {
        const config = parseEnv(devEnv());
        expect(config).toMatchObject({
            nodeEnv: "development",
            isDevelopment: true,
            isProduction: false,
            port: 8000,
            trustProxy: 0,
            logLevel: "info",
            db: { name: "SamarthAI" },
            cookies: { sameSite: "lax", secure: false, csrfEnabled: true },
            email: { transport: "log", fromName: "SAMARTH AI" },
            rateLimit: { windowMs: 60_000, max: 100, ipMultiplier: 1 },
        });
        expect(config.auth.accessExpiryMs).toBe(15 * 60_000);
        expect(config.auth.refreshExpiryMs).toBe(7 * 24 * 3600_000);
        expect(config.auth.refreshRememberExpiryMs).toBe(30 * 24 * 3600_000);
        expect(Object.isFrozen(config)).toBe(true);
        expect(Object.isFrozen(config.auth)).toBe(true);
        expect(Object.isFrozen(config.corsAllowedOrigins)).toBe(true);
    });

    it("provides test-friendly defaults when NODE_ENV=test and ignores nothing explicit", () => {
        const config = parseEnv({ NODE_ENV: "test", LOG_LEVEL: "warn" });
        expect(config.isTest).toBe(true);
        expect(config.email.transport).toBe("memory");
        expect(config.logLevel).toBe("warn");
        expect(config.auth.accessSecret.length).toBeGreaterThanOrEqual(32);
    });

    it("exposes the config loaded for this test run as `env`", () => {
        expect(env.nodeEnv).toBe("test");
        expect(env.email.transport).toBe("memory");
    });

    it("treats blank dotenv values as unset and tolerates a trailing comma in the CORS list", () => {
        const config = parseEnv(
            devEnv({
                COOKIE_DOMAIN: "",
                PORT: "",
                CORS_ALLOWED_ORIGINS:
                    "http://localhost:5173/, http://127.0.0.1:5173,,",
            })
        );
        expect(config.port).toBe(8000);
        expect(config.cookies.domain).toBeUndefined();
        expect(config.corsAllowedOrigins).toEqual([
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]);
    });

    it("derives Secure from production or SameSite=None, and defaults trust proxy to one hop in production", () => {
        const prod = parseEnv(prodEnv());
        expect(prod.cookies.secure).toBe(true);
        expect(prod.trustProxy).toBe(1);
        const none = parseEnv(
            devEnv({ COOKIE_SAMESITE: "none", COOKIE_DOMAIN: ".example.test" })
        );
        expect(none.cookies.secure).toBe(true);
        expect(parseEnv(prodEnv({ TRUST_PROXY: "2" })).trustProxy).toBe(2);
    });

    it("parses policy lists and switches", () => {
        const config = parseEnv(
            devEnv({
                ALLOWED_EMAIL_DOMAINS: "Gov.in, nic.in",
                ALLOW_SELF_REGISTRATION: "false",
            })
        );
        expect(config.auth.allowedEmailDomains).toEqual(["gov.in", "nic.in"]);
        expect(config.auth.allowSelfRegistration).toBe(false);
    });
});

describe("parseEnv: invalid configuration fails fast", () => {
    it("lists every missing required variable by name", () => {
        const text = issuesOf({ NODE_ENV: "development" });
        for (const name of [
            "FRONTEND_URL",
            "CORS_ALLOWED_ORIGINS",
            "MONGODB_URI",
            "ACCESS_TOKEN_SECRET",
            "REFRESH_TOKEN_SECRET",
        ]) {
            expect(text).toContain(name);
        }
    });

    it("requires NODE_ENV", () => {
        expect(issuesOf({ ...devEnv(), NODE_ENV: undefined })).toContain(
            "NODE_ENV"
        );
    });

    it("rejects secrets shorter than 32 characters without echoing them", () => {
        const short = "too-short-secret-value";
        const text = issuesOf(devEnv({ ACCESS_TOKEN_SECRET: short }));
        expect(text).toContain("ACCESS_TOKEN_SECRET");
        expect(text).not.toContain(short);
    });

    it("rejects identical secrets", () => {
        const same = secret("same");
        expect(
            issuesOf(
                devEnv({
                    ACCESS_TOKEN_SECRET: same,
                    REFRESH_TOKEN_SECRET: same,
                })
            )
        ).toContain("must all differ");
    });

    it.each([
        ["wildcard", "*"],
        ["wildcard among valid origins", "http://localhost:5173,*"],
        ["a path", "http://localhost:5173/app"],
        ["a non-http scheme", "ftp://localhost:5173"],
        ["not a URL", "localhost"],
        ["only empty entries", " , ,"],
    ])("rejects a CORS list with %s", (_label, value) => {
        expect(issuesOf(devEnv({ CORS_ALLOWED_ORIGINS: value }))).toContain(
            "CORS_ALLOWED_ORIGINS"
        );
    });

    it("rejects a FRONTEND_URL that is not a bare origin", () => {
        expect(
            issuesOf(devEnv({ FRONTEND_URL: "http://localhost:5173/app" }))
        ).toContain("FRONTEND_URL");
    });

    it("rejects a non-mongodb URI and an out-of-range port", () => {
        expect(issuesOf(devEnv({ MONGODB_URI: "postgres://x" }))).toContain(
            "MONGODB_URI"
        );
        expect(issuesOf(devEnv({ PORT: "70000" }))).toContain("PORT");
    });

    it.each([
        [
            "an access token longer than 15m",
            { ACCESS_TOKEN_EXPIRY: "1d" },
            "ACCESS_TOKEN_EXPIRY",
        ],
        [
            "a refresh expiry over the 30d cap",
            { REFRESH_TOKEN_EXPIRY: "31d" },
            "REFRESH_TOKEN_EXPIRY",
        ],
        [
            "a remember expiry over the 90d cap",
            { REFRESH_TOKEN_REMEMBER_EXPIRY: "91d" },
            "REFRESH_TOKEN_REMEMBER_EXPIRY",
        ],
        [
            "remember shorter than normal",
            { REFRESH_TOKEN_REMEMBER_EXPIRY: "1d" },
            "REFRESH_TOKEN_REMEMBER_EXPIRY",
        ],
        [
            "a malformed duration",
            { ACCESS_TOKEN_EXPIRY: "soon" },
            "ACCESS_TOKEN_EXPIRY",
        ],
        [
            "SameSite=None without a cookie domain",
            { COOKIE_SAMESITE: "none" },
            "COOKIE_DOMAIN",
        ],
        [
            "brevo without an API key",
            { EMAIL_TRANSPORT: "brevo", EMAIL_FROM_ADDRESS: "a@example.test" },
            "BREVO_API_KEY",
        ],
        [
            "brevo without a sender",
            { EMAIL_TRANSPORT: "brevo", BREVO_API_KEY: "x" },
            "EMAIL_FROM_ADDRESS",
        ],
        [
            "a real LLM provider without models",
            { LLM_PROVIDER: "anthropic" },
            "LLM_MODEL_FAST",
        ],
        [
            "an unknown email transport",
            { EMAIL_TRANSPORT: "smtp" },
            "EMAIL_TRANSPORT",
        ],
    ])("rejects %s", (_label, overrides, name) => {
        expect(issuesOf(devEnv(overrides))).toContain(name);
    });
});

describe("parseEnv: production guard rails", () => {
    it("accepts a complete production configuration", () => {
        expect(parseEnv(prodEnv()).isProduction).toBe(true);
    });

    it("refuses the memory transport (TEST-42)", () => {
        expect(issuesOf(prodEnv({ EMAIL_TRANSPORT: "memory" }))).toContain(
            "memory is refused"
        );
    });

    it("requires an explicit email transport", () => {
        expect(issuesOf(prodEnv({ EMAIL_TRANSPORT: undefined }))).toContain(
            "EMAIL_TRANSPORT"
        );
    });

    it("refuses disabled CSRF and a raised IP multiplier", () => {
        expect(issuesOf(prodEnv({ CSRF_ENABLED: "false" }))).toContain(
            "CSRF_ENABLED"
        );
        expect(issuesOf(prodEnv({ RATE_LIMIT_IP_MULTIPLIER: "50" }))).toContain(
            "RATE_LIMIT_IP_MULTIPLIER"
        );
    });

    it("requires https for the frontend and every CORS origin", () => {
        expect(
            issuesOf(prodEnv({ FRONTEND_URL: "http://app.example.test" }))
        ).toContain("FRONTEND_URL");
        expect(
            issuesOf(
                prodEnv({
                    CORS_ALLOWED_ORIGINS:
                        "https://app.example.test,http://localhost:5173",
                })
            )
        ).toContain("CORS_ALLOWED_ORIGINS");
    });

    it("requires Cloudinary and Google client id", () => {
        const text = issuesOf(
            prodEnv({
                CLOUDINARY_CLOUD_NAME: undefined,
                CLOUDINARY_API_KEY: undefined,
                CLOUDINARY_API_SECRET: undefined,
                GOOGLE_CLIENT_ID: undefined,
            })
        );
        for (const name of [
            "CLOUDINARY_CLOUD_NAME",
            "CLOUDINARY_API_KEY",
            "CLOUDINARY_API_SECRET",
            "GOOGLE_CLIENT_ID",
        ]) {
            expect(text).toContain(name);
        }
    });

    it("allows missing Google client id when Google login is off", () => {
        expect(() =>
            parseEnv(
                prodEnv({
                    GOOGLE_CLIENT_ID: undefined,
                    ALLOW_GOOGLE_LOGIN: "false",
                })
            )
        ).not.toThrow();
    });
});
