import dotenv from "dotenv";
import { z } from "zod";
import { DB_NAME } from "#constants/dbName.js";
import { crossChecks } from "./envChecks.js";
import { envFields, text } from "./envFields.js";
import { shapeConfig } from "./envShape.js";

/** Raised by parseEnv. `issues` lists "NAME: problem" lines and never contains a configured value. */
export class EnvValidationError extends Error {
    constructor(issues) {
        super(
            `Invalid environment configuration:\n${issues.map((line) => `  - ${line}`).join("\n")}`
        );
        this.name = "EnvValidationError";
        this.issues = issues;
    }
}

// Test-only values (NODE_ENV=test). Secrets are built, not written as literals, so no secret-looking string lives in source.
const testSecret = (label) => `test-only-${label}-`.padEnd(48, "x");
const TEST_DEFAULTS = {
    FRONTEND_URL: "http://localhost:5173",
    CORS_ALLOWED_ORIGINS: "http://localhost:5173",
    MONGODB_URI: `mongodb://127.0.0.1:27017/${DB_NAME}Test`,
    ACCESS_TOKEN_SECRET: testSecret("access"),
    REFRESH_TOKEN_SECRET: testSecret("refresh"),
    IDENTIFIER_HASH_SECRET: testSecret("identifier"),
    EMAIL_TRANSPORT: "memory",
    LOG_LEVEL: "silent",
    CLOUDINARY_CLOUD_NAME: "test-cloud",
    CLOUDINARY_API_KEY: "test-key",
    CLOUDINARY_API_SECRET: testSecret("cloudinary"),
};

// Cloudinary variables are declared only here and in the integration (MEDIA-03, check cloudinary-only-in-integration).
const CLOUDINARY_NAMES = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
];

const schema = z
    .object({
        ...envFields,
        CLOUDINARY_CLOUD_NAME: text().optional(),
        CLOUDINARY_API_KEY: text().optional(),
        CLOUDINARY_API_SECRET: text().optional(),
    })
    .superRefine((values, ctx) => {
        crossChecks(values, ctx);
        if (values.NODE_ENV !== "production") return;
        for (const name of CLOUDINARY_NAMES) {
            if (!values[name]) {
                ctx.addIssue({
                    code: "custom",
                    path: [name],
                    message: "is required in production",
                });
            }
        }
    });

/** Drops blank values (dotenv `FOO=`) and layers test defaults under the real values when NODE_ENV=test. */
function prepare(raw) {
    const present = Object.fromEntries(
        Object.entries(raw).filter(
            ([, value]) => typeof value === "string" && value.trim() !== ""
        )
    );
    return present.NODE_ENV === "test"
        ? { ...TEST_DEFAULTS, ...present }
        : present;
}

const deepFreeze = (value) => {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
        Object.freeze(value);
        Object.values(value).forEach(deepFreeze);
    }
    return value;
};

/**
 * Validates a raw environment object and returns the frozen, typed config.
 * Throws EnvValidationError listing every problem (names only, never values).
 */
export function parseEnv(raw) {
    const result = schema.safeParse(prepare(raw));
    if (!result.success) {
        const issues = result.error.issues.map(
            (issue) => `${issue.path.join(".") || "env"}: ${issue.message}`
        );
        throw new EnvValidationError(issues);
    }
    const v = result.data;
    return deepFreeze({
        ...shapeConfig(v),
        cloudinary: {
            cloudName: v.CLOUDINARY_CLOUD_NAME,
            apiKey: v.CLOUDINARY_API_KEY,
            apiSecret: v.CLOUDINARY_API_SECRET,
        },
    });
}

// The only dotenv call in the code base (BE-04). Tests never read a developer's .env file.
if (process.env.NODE_ENV !== "test") dotenv.config({ quiet: true });

/** The frozen, typed configuration. Importing this module validates the environment (fail fast, BE-08). */
export const env = parseEnv(process.env);
