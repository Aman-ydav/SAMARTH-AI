import { OAuth2Client } from "google-auth-library";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { ApiError } from "#utils/apiError.js";
import { normalizeEmail } from "#utils/strings.js";

const GOOGLE_ISSUERS = Object.freeze([
    "accounts.google.com",
    "https://accounts.google.com",
]);
const TIMEOUT_MS = 8000;
const NETWORK_CODES = new Set([
    "ECONNREFUSED",
    "ENOTFOUND",
    "ETIMEDOUT",
    "ECONNRESET",
    "EAI_AGAIN",
]);

const tokenInvalid = (cause) =>
    ApiError.unauthorized(ERROR_CODES.GOOGLE_TOKEN_INVALID, { cause });

function withTimeout(promise, timeoutMs) {
    let timer;
    const deadline = new Promise((_resolve, reject) => {
        timer = setTimeout(
            () =>
                reject(
                    Object.assign(new Error("Google timeout"), {
                        code: "ETIMEDOUT",
                    })
                ),
            timeoutMs
        );
    });
    return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

/**
 * Builds the Google ID-token verifier (AUTH-41, AUTH-42). It never trusts what the browser says about the user: the
 * library checks the signature against Google's keys, `aud` and `exp`; this adapter re-checks the audience, the issuer,
 * the expiry and `email_verified`, matches the optional nonce, and returns only `{ sub, email, name }`.
 *
 * Failures: a bad credential is 401 GOOGLE_TOKEN_INVALID, an unverified address 401 GOOGLE_EMAIL_UNVERIFIED, Google
 * being unreachable 502 INTEGRATION_ERROR (the cause is kept for the logs, never sent).
 *
 * @param {{ clientId?: string, client?: object, timeoutMs?: number, now?: () => number }} options
 * @returns {(credential: string, options?: { nonce?: string }) => Promise<{ sub: string, email: string, name: string }>}
 */
export function createGoogleVerifier({
    clientId,
    client = clientId ? new OAuth2Client(clientId) : undefined,
    timeoutMs = TIMEOUT_MS,
    now = Date.now,
} = {}) {
    return async function verifyGoogleCredential(credential, { nonce } = {}) {
        if (!clientId || !client) {
            throw ApiError.forbidden(ERROR_CODES.FORBIDDEN, {
                message: "Google sign-in is not configured.",
            });
        }
        let payload;
        try {
            const ticket = await withTimeout(
                client.verifyIdToken({
                    idToken: credential,
                    audience: clientId,
                }),
                timeoutMs
            );
            payload = ticket?.getPayload?.();
        } catch (error) {
            if (NETWORK_CODES.has(error?.code) || error?.response) {
                throw ApiError.badGateway(ERROR_CODES.INTEGRATION_ERROR, {
                    cause: error,
                });
            }
            throw tokenInvalid(error);
        }
        if (
            !payload ||
            payload.aud !== clientId ||
            !GOOGLE_ISSUERS.includes(payload.iss) ||
            typeof payload.sub !== "string" ||
            payload.sub === "" ||
            typeof payload.email !== "string" ||
            !(Number(payload.exp) * 1000 > now())
        ) {
            throw tokenInvalid();
        }
        if (payload.email_verified !== true) {
            throw ApiError.unauthorized(ERROR_CODES.GOOGLE_EMAIL_UNVERIFIED);
        }
        if (nonce !== undefined && payload.nonce !== nonce)
            throw tokenInvalid();
        const email = normalizeEmail(payload.email);
        return {
            sub: payload.sub,
            email,
            name: String(payload.name ?? "").trim() || email.split("@")[0],
        };
    };
}
