import { ERROR_CODES } from "#constants/errorCodes.js";
import {
    MEDIA_DELIVERY_TYPES,
    MEDIA_KINDS,
    MEDIA_RESOURCE_TYPES,
} from "#constants/mediaKinds.js";
import { ApiError } from "#utils/apiError.js";

const MB = 1024 * 1024;
const { IMAGE, VIDEO, RAW } = MEDIA_RESOURCE_TYPES;
const DOCX =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX =
    "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** Allowed file types: extensions, Cloudinary format and resource type. SVG, GIF, HTML, executables and archives are absent on purpose. */
export const FILE_TYPES = Object.freeze({
    "image/jpeg": {
        extensions: ["jpg", "jpeg"],
        format: "jpg",
        resourceType: IMAGE,
    },
    "image/png": { extensions: ["png"], format: "png", resourceType: IMAGE },
    "image/webp": { extensions: ["webp"], format: "webp", resourceType: IMAGE },
    "video/mp4": { extensions: ["mp4"], format: "mp4", resourceType: VIDEO },
    "video/webm": { extensions: ["webm"], format: "webm", resourceType: VIDEO },
    "video/quicktime": {
        extensions: ["mov"],
        format: "mov",
        resourceType: VIDEO,
    },
    "application/pdf": {
        extensions: ["pdf"],
        format: "pdf",
        resourceType: RAW,
    },
    [DOCX]: { extensions: ["docx"], format: "docx", resourceType: RAW },
    [PPTX]: { extensions: ["pptx"], format: "pptx", resourceType: RAW },
    "text/plain": { extensions: ["txt"], format: "txt", resourceType: RAW },
});

const IMAGES = ["image/jpeg", "image/png", "image/webp"];
const DOCS = ["application/pdf", DOCX, PPTX, "text/plain"];
const rule = (resourceType, mimes, maxBytes, delivery, direct = false) =>
    Object.freeze({
        resourceType,
        mimes: Object.freeze(mimes),
        maxBytes,
        delivery,
        direct,
    });
const { PUBLIC, AUTHENTICATED } = MEDIA_DELIVERY_TYPES;

/** Limits per kind (MEDIA-08). `direct` rules (video) go through signed browser uploads only, never Multer (MEDIA-07). */
export const MEDIA_RULES = Object.freeze({
    [MEDIA_KINDS.AVATARS]: [
        rule(IMAGE, ["image/jpeg", "image/png", "image/webp"], 2 * MB, PUBLIC),
    ],
    [MEDIA_KINDS.MARKETING]: [
        rule(IMAGE, IMAGES, 10 * MB, PUBLIC),
        rule(VIDEO, ["video/mp4", "video/webm"], 100 * MB, PUBLIC, true),
    ],
    [MEDIA_KINDS.LEARNING_CONTENT]: [
        rule(
            VIDEO,
            ["video/mp4", "video/webm", "video/quicktime"],
            100 * MB,
            PUBLIC,
            true
        ),
        rule(RAW, DOCS, 10 * MB, AUTHENTICATED),
    ],
    [MEDIA_KINDS.CERTIFICATES]: [
        rule(RAW, ["application/pdf"], 5 * MB, AUTHENTICATED),
        rule(IMAGE, ["image/png"], 5 * MB, AUTHENTICATED),
    ],
    [MEDIA_KINDS.TEMP]: [
        rule(IMAGE, IMAGES, 10 * MB, PUBLIC),
        rule(
            VIDEO,
            ["video/mp4", "video/webm", "video/quicktime"],
            100 * MB,
            PUBLIC,
            true
        ),
        rule(RAW, DOCS, 10 * MB, PUBLIC),
    ],
});

const startsWith = (buffer, bytes, offset = 0) =>
    bytes.every((byte, index) => buffer[offset + index] === byte);
const ascii = (buffer, start, end) =>
    buffer.subarray(start, end).toString("latin1");
const MARKUP_START = /^[\sFEFF]*<(\?xml|!doctype|html|svg|script|iframe|body)/i;

function detectText(buffer) {
    if (buffer.includes(0)) return null;
    let text;
    try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
        return null;
    }
    return MARKUP_START.test(text.slice(0, 256)) ? null : "text/plain";
}

/** Reads magic bytes and returns the real MIME type, or null when the content is not an allowed type (MEDIA-06). */
export function detectMime(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;
    if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "image/jpeg";
    if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        return "image/png";
    if (ascii(buffer, 0, 4) === "RIFF" && ascii(buffer, 8, 12) === "WEBP")
        return "image/webp";
    if (ascii(buffer, 0, 5) === "%PDF-") return "application/pdf";
    if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm";
    if (ascii(buffer, 4, 8) === "ftyp")
        return ascii(buffer, 8, 12) === "qt  "
            ? "video/quicktime"
            : "video/mp4";
    if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) {
        const head = ascii(buffer, 0, 8192);
        if (head.includes("word/")) return DOCX;
        if (head.includes("ppt/")) return PPTX;
        return null;
    }
    const executableOrGif =
        ascii(buffer, 0, 4) === "GIF8" ||
        ascii(buffer, 0, 2) === "MZ" ||
        (buffer[0] === 0x7f && ascii(buffer, 1, 4) === "ELF");
    if (executableOrGif) return null;
    return detectText(buffer);
}

const extensionOf = (filename) =>
    String(filename ?? "").split(".").length > 1
        ? String(filename).split(".").pop().toLowerCase()
        : "";
const typeError = (message, field = "file") =>
    ApiError.badRequest(ERROR_CODES.MEDIA_TYPE_NOT_ALLOWED, {
        message,
        errors: [
            {
                field,
                message,
                code: ERROR_CODES.MEDIA_TYPE_NOT_ALLOWED,
            },
        ],
    });

/** Rules for a kind; unknown kinds are a 400 (the kind always comes from a validated enum). */
export function getKindRules(kind) {
    const rules = MEDIA_RULES[kind];
    if (!rules)
        throw ApiError.badRequest(ERROR_CODES.VALIDATION_ERROR, {
            message: "Unknown media kind",
            errors: [{ field: "kind", message: "Unknown media kind" }],
        });
    return rules;
}

/** The rule that accepts `mime` for `kind`, or null. */
export const findRule = (kind, mime) =>
    getKindRules(kind).find((candidate) => candidate.mimes.includes(mime)) ??
    null;

/** Largest in-memory (Multer) size for a kind; video is excluded because it is direct-upload only. */
export const multerLimitFor = (kind) =>
    Math.max(
        ...getKindRules(kind)
            .filter((item) => !item.direct)
            .map((item) => item.maxBytes),
        0
    );

/** MIME types Multer may accept for a kind. */
export const multerMimesFor = (kind) =>
    getKindRules(kind)
        .filter((item) => !item.direct)
        .flatMap((item) => [...item.mimes]);

/** Cloudinary `allowed_formats` for a rule (MEDIA-06 second guard). */
export const allowedFormatsFor = (matchedRule) =>
    matchedRule.mimes.map((mime) => FILE_TYPES[mime].format);

/**
 * Validates a claimed upload before a signature is issued (MEDIA-07): kind, MIME and declared size.
 * Cloudinary cannot cap signed uploads, so `confirm` re-checks the real asset (MEDIA-07d).
 */
export function assertSignatureRequest({ kind, mime, bytes }) {
    const matched = findRule(kind, mime);
    if (!matched)
        throw typeError(
            "This file type is not allowed for this upload",
            "contentType"
        );
    if (!Number.isInteger(bytes) || bytes <= 0)
        throw ApiError.badRequest(ERROR_CODES.UPLOAD_INVALID, {
            message: "The file is empty",
        });
    if (bytes > matched.maxBytes)
        throw ApiError.fromCode(ERROR_CODES.MEDIA_TOO_LARGE);
    return matched;
}

/**
 * Validates one in-memory file (Multer) against the media policy: non-zero size, per-kind size, allowed MIME, extension
 * that matches the type, and magic bytes that match the claimed type (MEDIA-06). Returns what the adapter needs.
 */
export function assertUploadFile({ kind, file }) {
    const matched = findRule(kind, file?.mimetype);
    if (!matched || matched.direct)
        throw typeError("This file type is not allowed for this upload");
    const size = file.size ?? file.buffer?.length ?? 0;
    if (size <= 0)
        throw ApiError.badRequest(ERROR_CODES.UPLOAD_INVALID, {
            message: "The file is empty",
            errors: [{ field: "file", message: "The file is empty" }],
        });
    if (size > matched.maxBytes)
        throw ApiError.fromCode(ERROR_CODES.FILE_TOO_LARGE);
    const type = FILE_TYPES[file.mimetype];
    if (!type.extensions.includes(extensionOf(file.originalname)))
        throw typeError("The file extension does not match its type");
    if (detectMime(file.buffer) !== file.mimetype)
        throw typeError("The file content does not match its type");
    return {
        rule: matched,
        mime: file.mimetype,
        format: type.format,
        resourceType: matched.resourceType,
        delivery: matched.delivery,
        bytes: size,
    };
}
