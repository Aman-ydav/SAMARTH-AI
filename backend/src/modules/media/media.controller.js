import { ApiResponse } from "#utils/apiResponse.js";
import { asyncHandler } from "#utils/asyncHandler.js";
import { WEBHOOK_HEADERS } from "./media.constants.js";
import { confirmMediaUpload, requestMediaSignature } from "./media.service.js";
import { deleteMedia, getMediaAccessUrl } from "./mediaAccess.service.js";
import { removeAvatar, setAvatar } from "./mediaAvatar.service.js";
import { handleMediaWebhook } from "./mediaWebhook.service.js";

/** The acting user comes from the verified session only, never from the body (BE-43, EDGE-22). */
const actor = (req) => ({
    id: String(req.user.id),
    role: req.user.role,
    orgId: String(req.user.orgId),
});

export const requestSignature = asyncHandler(async (req, res) => {
    const data = await requestMediaSignature({
        user: actor(req),
        input: req.validated.body,
    });
    return ApiResponse.created(data, "Upload signature issued").send(res);
});

export const confirmUpload = asyncHandler(async (req, res) => {
    const { mediaId, publicId } = req.validated.body;
    const data = await confirmMediaUpload({
        user: actor(req),
        mediaId,
        publicId,
    });
    return ApiResponse.ok(data, "Upload confirmed").send(res);
});

export const getAccessUrl = asyncHandler(async (req, res) => {
    const data = await getMediaAccessUrl({
        user: actor(req),
        id: req.validated.params.id,
    });
    return ApiResponse.ok(data, "Access link issued").send(res);
});

export const removeMedia = asyncHandler(async (req, res) => {
    const data = await deleteMedia({
        user: actor(req),
        id: req.validated.params.id,
    });
    return ApiResponse.ok(data, "Media deleted").send(res);
});

export const putAvatar = asyncHandler(async (req, res) => {
    const user = await setAvatar({
        user: actor(req),
        upload: req.uploads[0],
    });
    return ApiResponse.ok({ user }, "Avatar updated").send(res);
});

export const deleteAvatar = asyncHandler(async (req, res) => {
    const user = await removeAvatar({ user: actor(req) });
    return ApiResponse.ok({ user }, "Avatar removed").send(res);
});

export const receiveWebhook = asyncHandler(async (req, res) => {
    const data = await handleMediaWebhook({
        rawBody: req.rawBody,
        timestamp: req.get(WEBHOOK_HEADERS.timestamp),
        signature: req.get(WEBHOOK_HEADERS.signature),
    });
    return ApiResponse.ok(data, "Webhook processed").send(res);
});
