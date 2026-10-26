import { describe, expect, it } from "vitest";
import {
    confirmBodySchema,
    emptyBodySchema,
    mediaIdParamsSchema,
    signatureBodySchema,
    webhookPayloadSchema,
} from "./media.validation.js";

const valid = {
    kind: "learning-content",
    resourceType: "video",
    contentType: "video/mp4",
    bytes: 1024,
};

describe("signatureBodySchema", () => {
    it("accepts a complete request and lowercases the content type", () => {
        const result = signatureBodySchema.parse({
            ...valid,
            contentType: " Video/MP4 ",
            filename: "intro.mp4",
        });
        expect(result.contentType).toBe("video/mp4");
    });

    it.each([
        ["unknown kind", { kind: "videos" }],
        ["unknown resource type", { resourceType: "audio" }],
        ["missing content type", { contentType: undefined }],
        ["bytes as a string", { bytes: "1024" }],
        ["fractional bytes", { bytes: 10.5 }],
        ["negative bytes", { bytes: -1 }],
        ["empty filename", { filename: "" }],
        ["control character in filename", { filename: "a\u0000b.mp4" }],
        ["overlong filename", { filename: "a".repeat(256) }],
    ])("rejects %s", (_label, patch) => {
        expect(
            signatureBodySchema.safeParse({ ...valid, ...patch }).success
        ).toBe(false);
    });

    it("lets a zero size through so the media policy can answer UPLOAD_INVALID", () => {
        expect(
            signatureBodySchema.safeParse({ ...valid, bytes: 0 }).success
        ).toBe(true);
    });

    it("rejects unknown fields when run through validate() strict mode", () => {
        expect(
            signatureBodySchema.strict().safeParse({ ...valid, orgId: "x" })
                .success
        ).toBe(false);
    });
});

describe("confirmBodySchema", () => {
    it("accepts exactly one of mediaId or publicId", () => {
        expect(confirmBodySchema.safeParse({ mediaId: "a" }).success).toBe(
            true
        );
        expect(confirmBodySchema.safeParse({ publicId: "a/b" }).success).toBe(
            true
        );
    });

    it("rejects neither and both", () => {
        expect(confirmBodySchema.safeParse({}).success).toBe(false);
        expect(
            confirmBodySchema.safeParse({ mediaId: "a", publicId: "b" }).success
        ).toBe(false);
    });
});

describe("other schemas", () => {
    it("params id is a bounded string (the service casts it to an ObjectId)", () => {
        expect(mediaIdParamsSchema.safeParse({ id: "abc" }).success).toBe(true);
        expect(mediaIdParamsSchema.safeParse({ id: "" }).success).toBe(false);
        expect(
            mediaIdParamsSchema.safeParse({ id: "x".repeat(65) }).success
        ).toBe(false);
    });

    it("emptyBodySchema allows only {}", () => {
        expect(emptyBodySchema.strict().safeParse({}).success).toBe(true);
        expect(emptyBodySchema.strict().safeParse({ a: 1 }).success).toBe(
            false
        );
    });

    it("webhook payload needs a notification type and keeps unknown keys", () => {
        expect(webhookPayloadSchema.safeParse({}).success).toBe(false);
        const parsed = webhookPayloadSchema.parse({
            notification_type: "upload",
            extra: 1,
        });
        expect(parsed.extra).toBe(1);
    });
});
