import { z } from "zod";
import { logger } from "@/lib/logger";

const DEFAULT_API_URL = "/api/v1";

const apiUrlSchema = z
    .string()
    .trim()
    .refine(
        (value) =>
            /^\/[^\s]*$/.test(value) || /^https?:\/\/[^\s]+$/.test(value),
        "invalid API url"
    )
    .transform((value) =>
        value.length > 1 ? value.replace(/\/+$/, "") : value
    );

const flagSchema = z
    .string()
    .trim()
    .toLowerCase()
    .transform((value) => value !== "false" && value !== "0");

const publicEnvSchema = z.object({
    VITE_API_URL: apiUrlSchema.optional().catch(undefined),
    VITE_GOOGLE_CLIENT_ID: z.string().trim().optional().catch(undefined),
    VITE_CLOUDINARY_CLOUD_NAME: z.string().trim().optional().catch(undefined),
    VITE_ALLOW_INDEXING: flagSchema.optional().catch(undefined),
    VITE_VAPID_PUBLIC_KEY: z.string().trim().optional().catch(undefined),
});

/**
 * Validates the public VITE_ variables and returns a frozen, typed view.
 * A bad API url falls back to the same-site default instead of white-screening the app.
 */
export function parseEnv(raw = {}, mode = {}) {
    const parsed = publicEnvSchema.safeParse(raw);
    const values = parsed.success ? parsed.data : {};
    if (raw.VITE_API_URL && values.VITE_API_URL === undefined) {
        logger.error("Ignoring invalid VITE_API_URL, using the default", {
            name: "VITE_API_URL",
        });
    }
    const googleClientId = values.VITE_GOOGLE_CLIENT_ID || "";
    return Object.freeze({
        apiUrl: values.VITE_API_URL ?? DEFAULT_API_URL,
        googleClientId,
        googleEnabled: googleClientId.length > 0,
        cloudinaryCloudName: values.VITE_CLOUDINARY_CLOUD_NAME || "",
        allowIndexing: values.VITE_ALLOW_INDEXING ?? true,
        vapidPublicKey: values.VITE_VAPID_PUBLIC_KEY || "",
        isDev: Boolean(mode.DEV),
        isProd: Boolean(mode.PROD),
        isTest: mode.MODE === "test",
    });
}

export const env = parseEnv(import.meta.env, import.meta.env);
