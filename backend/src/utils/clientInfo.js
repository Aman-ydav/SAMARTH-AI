import { hmacIdentifier } from "./hash.js";
import { truncate } from "./strings.js";

/** Client IP as resolved by Express from the exact `trust proxy` hop count (BE-03, AUTH-58). Never read forwarded headers directly. */
export const getClientIp = (req) => req.ip ?? "";

/** HMAC of the client IP (R37: only the hash is stored, never the raw or a masked IP). */
export const getIpHash = (req, secret) =>
    hmacIdentifier(getClientIp(req), secret);

/** User agent cut to 200 characters (AUTH-10). */
export const getUserAgent = (req) =>
    truncate(req.headers?.["user-agent"], 200).trim();

/** HMAC of the user agent, used for new-device detection (AUTH-39). */
export const getUserAgentHash = (req, secret) =>
    hmacIdentifier(getUserAgent(req), secret);
