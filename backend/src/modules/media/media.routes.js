import express from "express";
import { MEDIA_KINDS } from "#constants/mediaKinds.js";
import { ROLE_LIST } from "#constants/roles.js";
import { createLimiter } from "#middlewares/rateLimit.js";
import { uploadMiddleware } from "#middlewares/upload.js";
import { validate } from "#middlewares/validate.js";
import {
    confirmUpload,
    deleteAvatar,
    getAccessUrl,
    putAvatar,
    receiveWebhook,
    removeMedia,
    requestSignature,
} from "./media.controller.js";
import {
    AVATAR_ROLES,
    MEDIA_RATE_LIMITS,
    UPLOAD_ROLES,
} from "./media.constants.js";
import {
    confirmBodySchema,
    emptyBodySchema,
    mediaIdParamsSchema,
    signatureBodySchema,
} from "./media.validation.js";

const perUser = (name, { windowMs, limit }) =>
    createLimiter({
        name,
        windowMs,
        limit,
        ipScoped: false,
        key: (req) => String(req.user.id),
    });

/**
 * Builds the media routes (doc 08 section 4 and `/me/avatar`). Paths are absolute below `/api/v1` so one router,
 * mounted at "/", serves both `/media/*` and `/me/avatar`. `authenticate` and `authorize` are injected (the real ones
 * come from index.js) so tests can run the module with stubs. Per-user limits need the user, so they follow `authenticate`.
 * Guard order: authenticate, authorize, limit, (upload parser), validate, controller (BE-61, doc 08 section 1).
 */
export function createMediaRouter({
    authenticate,
    authorize,
    limits = MEDIA_RATE_LIMITS,
} = {}) {
    const router = express.Router({ caseSensitive: true });
    const uploadLimit = perUser("media-upload", limits.upload);
    const avatarLimit = perUser("media-avatar", limits.avatar);
    const uploaders = authorize(...UPLOAD_ROLES);
    const everyone = authorize(...ROLE_LIST);

    router.post(
        "/media/signatures",
        authenticate,
        uploaders,
        uploadLimit,
        validate({ body: signatureBodySchema }),
        requestSignature
    );
    router.post(
        "/media/confirm",
        authenticate,
        uploaders,
        uploadLimit,
        validate({ body: confirmBodySchema }),
        confirmUpload
    );
    // public: Cloudinary calls this; trust comes from X-Cld-Signature over the raw body, and it is CSRF-exempt (AUTH-18)
    router.post("/media/webhook", validate({}), receiveWebhook);
    router.get(
        "/media/:id/access",
        authenticate,
        everyone,
        validate({ params: mediaIdParamsSchema }),
        getAccessUrl
    );
    router.delete(
        "/media/:id",
        authenticate,
        everyone,
        validate({ params: mediaIdParamsSchema }),
        removeMedia
    );
    router.put(
        "/me/avatar",
        authenticate,
        authorize(...AVATAR_ROLES),
        avatarLimit,
        uploadMiddleware({ kind: MEDIA_KINDS.AVATARS, field: "file" }),
        validate({ body: emptyBodySchema }),
        putAvatar
    );
    router.delete(
        "/me/avatar",
        authenticate,
        authorize(...AVATAR_ROLES),
        validate({ body: emptyBodySchema }),
        deleteAvatar
    );
    return router;
}
