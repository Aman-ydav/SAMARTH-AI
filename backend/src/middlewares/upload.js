import multer from "multer";
import { ERROR_CODES } from "#constants/errorCodes.js";
import {
    assertUploadFile,
    multerLimitFor,
    multerMimesFor,
} from "#integrations/cloudinary/mediaPolicy.mapper.js";
import { ApiError } from "#utils/apiError.js";
import { sanitizeInPlace } from "#utils/sanitize.js";

/**
 * Multer in memory for small images and documents (MEDIA-05): no temp files, so nothing to clean up (BE-45).
 * Limits per kind (size, count, fields) are enforced while streaming; every file then passes the media policy
 * (allowed MIME, extension, magic bytes, size, non-zero, MEDIA-06). Video never goes through here (MEDIA-07).
 *
 * Result: `req.uploads = [{ file, policy }]` where `policy` is what `uploadBuffer` needs. Multipart text fields are
 * sanitised like any other body. Errors flow to the central handler (413 FILE_TOO_LARGE, 400 UPLOAD_INVALID, ...).
 *
 * @param {{ kind: string, field?: string, maxFiles?: number }} options
 */
export function uploadMiddleware({ kind, field = "file", maxFiles = 1 }) {
    const allowedMimes = new Set(multerMimesFor(kind));
    const parser = multer({
        storage: multer.memoryStorage(),
        limits: {
            fileSize: multerLimitFor(kind),
            files: maxFiles,
            fields: 10,
            fieldSize: 10_000,
            fieldNameSize: 100,
            parts: maxFiles + 10,
            headerPairs: 50,
        },
        fileFilter(_req, file, callback) {
            if (allowedMimes.has(file.mimetype)) return callback(null, true);
            return callback(
                ApiError.badRequest(ERROR_CODES.MEDIA_TYPE_NOT_ALLOWED, {
                    errors: [
                        { field, message: "This file type is not allowed" },
                    ],
                })
            );
        },
    });
    const parse =
        maxFiles === 1 ? parser.single(field) : parser.array(field, maxFiles);

    return (req, res, next) =>
        parse(req, res, (error) => {
            if (error) return next(error);
            try {
                sanitizeInPlace(req.body);
                const files = req.file ? [req.file] : (req.files ?? []);
                if (files.length === 0) {
                    throw ApiError.badRequest(ERROR_CODES.UPLOAD_INVALID, {
                        message: "No file was uploaded",
                        errors: [{ field, message: "A file is required" }],
                    });
                }
                req.uploads = files.map((file) => ({
                    file,
                    policy: assertUploadFile({ kind, file }),
                }));
                return next();
            } catch (failure) {
                return next(failure);
            }
        });
}
