import { v2 as cloudinary } from "cloudinary";
import { env } from "#config/env.js";
import { ERROR_CODES } from "#constants/errorCodes.js";
import {
    MEDIA_DELIVERY_TYPES,
    MEDIA_RESOURCE_TYPES,
} from "#constants/mediaKinds.js";
import { ApiError } from "#utils/apiError.js";
import { logger } from "#utils/logger.js";
import { buildFolder, generatePublicId } from "./folders.mapper.js";
import {
    allowedFormatsFor,
    assertSignatureRequest,
} from "./mediaPolicy.mapper.js";

/** The single place the Cloudinary SDK is configured and imported (MEDIA-03). */
cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
});

const UPLOAD_TIMEOUT_MS = 120_000;
const API_TIMEOUT_MS = 15_000;
const WEBHOOK_MAX_AGE_SECONDS = 2 * 60 * 60;
const storageType = (delivery) =>
    delivery === MEDIA_DELIVERY_TYPES.AUTHENTICATED
        ? "authenticated"
        : "upload";

/** Calls `fn`, retrying idempotent operations with exponential backoff (BE-46). Never use for uploads. */
async function withRetry(fn, { retries = 2, baseDelayMs = 200 } = {}) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (error?.http_code === 404 || attempt === retries) break;
            await new Promise((resolve) =>
                setTimeout(resolve, baseDelayMs * 2 ** attempt)
            );
        }
    }
    throw lastError;
}

/** Normalises an SDK asset into the shape stored in the `media` collection (MEDIA-13). Values come from Cloudinary, never the client. */
export function normalizeAsset(result) {
    return {
        publicId: result.public_id,
        resourceType: result.resource_type,
        deliveryType:
            result.type === "authenticated"
                ? MEDIA_DELIVERY_TYPES.AUTHENTICATED
                : MEDIA_DELIVERY_TYPES.PUBLIC,
        format: result.format,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        duration: result.duration,
        secureUrl: result.secure_url,
        version: result.version,
    };
}

const integrationFailure = (code, cause, event) => {
    logger.error({ err: cause, event }, "cloudinary call failed");
    return ApiError.badGateway(code, { cause });
};

/**
 * Uploads an in-memory file with `upload_stream` (MEDIA-05). `policy` is the result of `assertUploadFile`.
 * Images are uploaded with an incoming transformation that strips EXIF/GPS (MEDIA-10).
 */
export async function uploadBuffer({ buffer, kind, policy, ownerId }) {
    const options = {
        resource_type: policy.resourceType,
        type: storageType(policy.delivery),
        folder: buildFolder(kind),
        public_id: generatePublicId({ ownerId }),
        allowed_formats: allowedFormatsFor(policy.rule).join(","),
        overwrite: false,
        use_filename: false,
        unique_filename: false,
        timeout: UPLOAD_TIMEOUT_MS,
        ...(policy.resourceType === MEDIA_RESOURCE_TYPES.IMAGE
            ? { transformation: [{ flags: "force_strip" }] }
            : {}),
    };
    try {
        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                options,
                (error, uploaded) => (error ? reject(error) : resolve(uploaded))
            );
            stream.end(buffer);
        });
        return normalizeAsset(result);
    } catch (error) {
        throw integrationFailure(
            ERROR_CODES.MEDIA_UPLOAD_FAILED,
            error,
            "upload"
        );
    }
}

/**
 * Parameters for a direct browser upload (MEDIA-07): only server-decided values are signed (MEDIA-07a).
 * The API secret never leaves the server; Cloudinary rejects signatures older than one hour.
 */
export function createSignedUpload({
    kind,
    mime,
    bytes,
    ownerId,
    now = Date.now(),
}) {
    const rule = assertSignatureRequest({ kind, mime, bytes });
    const folder = buildFolder(kind);
    const publicId = generatePublicId({ ownerId });
    const allowedFormats = allowedFormatsFor(rule).join(",");
    const timestamp = Math.floor(now / 1000);
    const type = storageType(rule.delivery);
    const signedParams = {
        allowed_formats: allowedFormats,
        folder,
        public_id: publicId,
        timestamp,
        type,
    };
    return {
        cloudName: env.cloudinary.cloudName,
        apiKey: env.cloudinary.apiKey,
        timestamp,
        signature: cloudinary.utils.api_sign_request(
            signedParams,
            env.cloudinary.apiSecret
        ),
        folder,
        publicId,
        fullPublicId: `${folder}/${publicId}`,
        allowedFormats,
        resourceType: rule.resourceType,
        type,
        maxBytes: rule.maxBytes,
    };
}

/** Reads the real asset from Cloudinary for the confirm step; unknown assets are 404 MEDIA_NOT_FOUND (MEDIA-07). */
export async function fetchAsset({ publicId, resourceType, deliveryType }) {
    try {
        const result = await withRetry(() =>
            cloudinary.api.resource(publicId, {
                resource_type: resourceType,
                type: storageType(deliveryType),
                timeout: API_TIMEOUT_MS,
            })
        );
        return normalizeAsset({
            ...result,
            resource_type: result.resource_type ?? resourceType,
        });
    } catch (error) {
        if (error?.http_code === 404)
            throw ApiError.notFound(ERROR_CODES.MEDIA_NOT_FOUND, {
                cause: error,
            });
        throw integrationFailure(ERROR_CODES.INTEGRATION_ERROR, error, "fetch");
    }
}

/** Deletes by stored publicId and resourceType, never by URL (MEDIA-09). Returns `{ deleted }`; a missing asset counts as already gone. */
export async function deleteAsset({ publicId, resourceType, deliveryType }) {
    try {
        const result = await withRetry(() =>
            cloudinary.uploader.destroy(publicId, {
                resource_type: resourceType,
                type: storageType(deliveryType),
                invalidate: true,
            })
        );
        return { deleted: result.result === "ok" };
    } catch (error) {
        throw integrationFailure(
            ERROR_CODES.INTEGRATION_ERROR,
            error,
            "delete"
        );
    }
}

/** Short-lived signed download URL for `authenticated` assets (MEDIA-08a). */
export function createAccessUrl({
    publicId,
    format,
    resourceType,
    ttlSeconds = 300,
    now = Date.now(),
}) {
    return cloudinary.utils.private_download_url(publicId, format, {
        resource_type: resourceType,
        type: "authenticated",
        expires_at: Math.floor(now / 1000) + ttlSeconds,
    });
}

/**
 * Verifies `X-Cld-Signature` over the RAW body and `X-Cld-Timestamp` (MEDIA-15). Stale (over 2 h) or bad signatures
 * throw 400 WEBHOOK_SIGNATURE_INVALID (R38) and nothing is processed.
 */
export function assertWebhookSignature({
    rawBody,
    timestamp,
    signature,
    now = Date.now(),
}) {
    const issuedAt = Number(timestamp);
    const fresh =
        Number.isFinite(issuedAt) &&
        Math.abs(now / 1000 - issuedAt) <= WEBHOOK_MAX_AGE_SECONDS;
    const valid =
        fresh &&
        typeof rawBody === "string" &&
        typeof signature === "string" &&
        cloudinary.utils.verifyNotificationSignature(
            rawBody,
            issuedAt,
            signature,
            WEBHOOK_MAX_AGE_SECONDS
        );
    if (!valid)
        throw ApiError.badRequest(ERROR_CODES.WEBHOOK_SIGNATURE_INVALID);
}
