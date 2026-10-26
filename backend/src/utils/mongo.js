import mongoose from "mongoose";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { ApiError } from "./apiError.js";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

/** Strict ObjectId check: exactly 24 hex characters (Mongoose also accepts any 12-character string). */
export const isValidObjectId = (value) =>
    typeof value === "string" && OBJECT_ID_PATTERN.test(value);

/** Casts to ObjectId or throws 400 INVALID_ID naming the field (DB-58, EDGE-13). */
export function toObjectId(value, field = "id") {
    if (value instanceof mongoose.Types.ObjectId) return value;
    if (!isValidObjectId(value)) {
        throw ApiError.badRequest(ERROR_CODES.INVALID_ID, {
            errors: [
                {
                    field,
                    message: "Invalid identifier",
                    code: ERROR_CODES.INVALID_ID,
                },
            ],
        });
    }
    return new mongoose.Types.ObjectId(value);
}

/** Escapes regex metacharacters so user text can be used in an anchored pattern (DB-58, EDGE-43). */
export const escapeRegex = (text) =>
    String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
