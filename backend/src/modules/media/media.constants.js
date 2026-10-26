import { MEDIA_KINDS } from "#constants/mediaKinds.js";
import { ROLES } from "#constants/roles.js";

const { LEARNER, TRAINER, ADMIN, SUPERADMIN } = ROLES;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Roles that may request a signed direct upload per kind (doc 08 section 4: "role-limited by kind").
 * Avatars go through PUT /me/avatar only (the server strips EXIF, MEDIA-10); certificates are issued by the server.
 */
export const SIGNATURE_ROLES_BY_KIND = Object.freeze({
    [MEDIA_KINDS.AVATARS]: Object.freeze([]),
    [MEDIA_KINDS.MARKETING]: Object.freeze([ADMIN, SUPERADMIN]),
    [MEDIA_KINDS.LEARNING_CONTENT]: Object.freeze([TRAINER, ADMIN, SUPERADMIN]),
    [MEDIA_KINDS.CERTIFICATES]: Object.freeze([]),
    [MEDIA_KINDS.TEMP]: Object.freeze([TRAINER, ADMIN, SUPERADMIN]),
});

/** Every role that can request at least one kind: the route-level `authorize` list for signatures and confirm. */
export const UPLOAD_ROLES = Object.freeze([
    ...new Set(Object.values(SIGNATURE_ROLES_BY_KIND).flat()),
]);

/** Roles that may read or delete media of other users in their own organisation. */
export const PRIVILEGED_ROLES = Object.freeze([ADMIN, SUPERADMIN]);

/** Roles allowed on the avatar endpoints (doc 08: L, T, A, S). */
export const AVATAR_ROLES = Object.freeze([
    LEARNER,
    TRAINER,
    ADMIN,
    SUPERADMIN,
]);

/** Proposed defaults from doc 08 (20/day per user); signatures and confirm share one bucket, avatars have their own. */
export const MEDIA_RATE_LIMITS = Object.freeze({
    upload: Object.freeze({ windowMs: DAY_MS, limit: 20 }),
    avatar: Object.freeze({ windowMs: DAY_MS, limit: 20 }),
});

/** A Cloudinary signature is valid for one hour (MEDIA-07a). */
export const SIGNATURE_TTL_MS = HOUR_MS;

/** A pending record outlives its signature by a day, then the TTL index removes it (the sweep normally acts first). */
export const PENDING_TTL_MS = 2 * DAY_MS;

/** Purged records are kept this long for audit before the TTL index removes them. */
export const PURGED_RETENTION_MS = 30 * DAY_MS;

/** Sweep thresholds (MEDIA-12): unconfirmed pending records and `temp/` assets older than 24 h. */
export const STALE_PENDING_MS = DAY_MS;
export const TEMP_MAX_AGE_MS = DAY_MS;
/** A failed Cloudinary delete is retried by the sweep after this grace period. */
export const PURGE_RETRY_AFTER_MS = 15 * 60 * 1000;
export const SWEEP_BATCH_SIZE = 100;

/** Signed download links for authenticated assets live five minutes (MEDIA-08a). */
export const ACCESS_URL_TTL_SECONDS = 300;

/** Webhook header names set by Cloudinary (MEDIA-15). */
export const WEBHOOK_HEADERS = Object.freeze({
    signature: "X-Cld-Signature",
    timestamp: "X-Cld-Timestamp",
});
