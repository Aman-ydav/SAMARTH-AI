import { z } from "zod";
import {
    MEDIA_KIND_LIST,
    MEDIA_RESOURCE_TYPE_LIST,
} from "#constants/mediaKinds.js";
import { hasControlCharacters } from "#utils/strings.js";

const noControlCharacters = (value) => !hasControlCharacters(value);

/** `POST /media/signatures`: what the client intends to upload. The server decides folder, public id and format list. */
export const signatureBodySchema = z.object({
    kind: z.enum(MEDIA_KIND_LIST),
    resourceType: z.enum(MEDIA_RESOURCE_TYPE_LIST),
    contentType: z.string().trim().toLowerCase().min(3).max(120),
    bytes: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    // Only used to cross-check the extension; it never becomes part of the stored name (MEDIA-04a).
    filename: z
        .string()
        .trim()
        .min(1)
        .max(255)
        .refine(noControlCharacters, "Control characters are not allowed")
        .optional(),
});

/** `POST /media/confirm`: exactly one of `mediaId` or the full `publicId`. */
export const confirmBodySchema = z
    .object({
        mediaId: z.string().trim().min(1).max(24).optional(),
        publicId: z.string().trim().min(1).max(255).optional(),
    })
    .refine(
        (value) => Number(!!value.mediaId) + Number(!!value.publicId) === 1,
        {
            message: "Send either mediaId or publicId",
            path: ["mediaId"],
        }
    );

/** `:id` is cast to an ObjectId in the service so a bad id answers 400 INVALID_ID (EDGE-13). */
export const mediaIdParamsSchema = z.object({
    id: z.string().trim().min(1).max(64),
});

/** The avatar endpoints take only the multipart `file`; any extra text field is refused. */
export const emptyBodySchema = z.object({});

/** Loose shape of a Cloudinary notification; unknown keys are kept and ignored (the signature already vouches for the body). */
export const webhookPayloadSchema = z.looseObject({
    notification_type: z.string().max(60),
    public_id: z.string().max(255).optional(),
    version: z.number().int().nonnegative().optional(),
    resource_type: z.string().max(20).optional(),
    type: z.string().max(30).optional(),
    format: z.string().max(10).optional(),
    bytes: z.number().int().nonnegative().optional(),
    width: z.number().int().nonnegative().optional(),
    height: z.number().int().nonnegative().optional(),
    secure_url: z.string().max(500).optional(),
    moderation_status: z.string().max(30).optional(),
    resources: z
        .array(
            z.looseObject({
                public_id: z.string().max(255),
                resource_type: z.string().max(20).optional(),
            })
        )
        .max(200)
        .optional(),
});
