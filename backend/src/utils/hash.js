import {
    createHash,
    createHmac,
    randomBytes,
    timingSafeEqual as nodeTimingSafeEqual,
} from "node:crypto";
import { env } from "#config/env.js";

/** URL-safe random token from `crypto` (default 32 bytes, AUTH-05). Never use Math.random for secrets. */
export const randomToken = (bytes = 32) =>
    randomBytes(bytes).toString("base64url");

/** Lowercase hex SHA-256 digest (one-time email tokens are stored this way, AUTH-29). */
export const sha256Hex = (value) =>
    createHash("sha256").update(String(value)).digest("hex");

/** Lowercase hex HMAC-SHA256 of `value` with `key`. */
export const hmacSha256Hex = (value, key) =>
    createHmac("sha256", key).update(String(value)).digest("hex");

/** HMAC for identifiers (login-attempt keys, IP and user-agent hashes, audit meta) with IDENTIFIER_HASH_SECRET (R9). */
export const hmacIdentifier = (value, secret = env.auth.identifierHashSecret) =>
    hmacSha256Hex(value, secret);

/** Keyed hash for refresh tokens with REFRESH_TOKEN_SECRET (AUTH-05). */
export const hmacRefreshToken = (token, secret = env.auth.refreshSecret) =>
    hmacSha256Hex(token, secret);

/** Constant-time string comparison; non-strings never match. Digesting first hides the length difference too. */
export function timingSafeEqual(a, b) {
    if (typeof a !== "string" || typeof b !== "string") return false;
    return nodeTimingSafeEqual(
        createHash("sha256").update(a).digest(),
        createHash("sha256").update(b).digest()
    );
}
