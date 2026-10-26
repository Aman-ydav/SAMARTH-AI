import { env } from "#config/env.js";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { MEDIA_KIND_LIST } from "#constants/mediaKinds.js";
import { ApiError } from "#utils/apiError.js";
import { randomToken } from "#utils/hash.js";

const ENV_FOLDERS = Object.freeze({
    development: "dev",
    test: "test",
    production: "prod",
});

/** Maps NODE_ENV to the folder segment `dev | test | prod` (MEDIA-04). The only place this mapping lives. */
export const cloudinaryEnvName = (nodeEnv = env.nodeEnv) =>
    ENV_FOLDERS[nodeEnv];

/** `samarth-ai/{env}/{kind}`: the only way a Cloudinary folder is built, so dev uploads never reach prod (MEDIA-04). */
export function buildFolder(kind, nodeEnv = env.nodeEnv) {
    if (!MEDIA_KIND_LIST.includes(kind))
        throw ApiError.badRequest(ERROR_CODES.VALIDATION_ERROR, {
            message: "Unknown media kind",
        });
    return `samarth-ai/${cloudinaryEnvName(nodeEnv)}/${kind}`;
}

/** Server-chosen asset name, optionally prefixed with the owner id; never derived from the client filename (MEDIA-04a). */
export const generatePublicId = ({ ownerId } = {}) =>
    `${ownerId ? `${ownerId}_` : ""}${randomToken(16)}`;
