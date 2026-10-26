import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "#config/env.js";
import { pngBuffer } from "#tests/helpers/fileFixtures.js";
import {
    createAccessUrl,
    createSignedUpload,
    deleteAsset,
    fetchAsset,
    normalizeAsset,
    uploadBuffer,
} from "./cloudinary.adapter.js";
import { cloudinaryFake } from "./cloudinary.mock.js";
import { findRule } from "./mediaPolicy.mapper.js";

vi.mock("cloudinary", async (importOriginal) =>
    (
        await import("#integrations/cloudinary/cloudinary.mock.js")
    ).buildMockedCloudinaryModule(await importOriginal())
);

const sha1 = (text) => createHash("sha1").update(text).digest("hex");
const policyFor = (kind, mime, delivery = "public") => ({
    rule: findRule(kind, mime),
    resourceType: findRule(kind, mime).resourceType,
    delivery,
});

const configuredAtImport = [...cloudinaryFake.configs];

beforeEach(() => {
    cloudinaryFake.reset();
});

describe("SDK configuration (MEDIA-03)", () => {
    it("is configured once from validated env with secure delivery", () => {
        expect(configuredAtImport).toHaveLength(1);
        expect(configuredAtImport[0]).toEqual({
            cloud_name: env.cloudinary.cloudName,
            api_key: env.cloudinary.apiKey,
            api_secret: env.cloudinary.apiSecret,
            secure: true,
        });
    });
});

describe("uploadBuffer (MEDIA-05, MEDIA-10)", () => {
    it("streams the buffer into the env-prefixed folder with a server-chosen public id", async () => {
        const asset = await uploadBuffer({
            buffer: pngBuffer(),
            kind: "avatars",
            policy: policyFor("avatars", "image/png"),
            ownerId: "507f1f77bcf86cd799439011",
        });
        const { options, bytes } = cloudinaryFake.uploads[0];
        expect(options.folder).toBe("samarth-ai/test/avatars");
        expect(options.public_id).toMatch(
            /^507f1f77bcf86cd799439011_[A-Za-z0-9_-]{22}$/
        );
        expect(options).toMatchObject({
            resource_type: "image",
            type: "upload",
            overwrite: false,
            use_filename: false,
            allowed_formats: "jpg,png,webp",
        });
        expect(bytes).toBe(pngBuffer().length);
        expect(asset).toMatchObject({
            resourceType: "image",
            deliveryType: "public",
            format: "png",
            version: 1700000000,
        });
        expect(asset.publicId).toBe(`${options.folder}/${options.public_id}`);
    });

    it("strips EXIF/GPS from images with an incoming force_strip transformation", async () => {
        await uploadBuffer({
            buffer: pngBuffer(),
            kind: "avatars",
            policy: policyFor("avatars", "image/png"),
        });
        expect(cloudinaryFake.uploads[0].options.transformation).toEqual([
            { flags: "force_strip" },
        ]);
    });

    it("uploads documents as raw authenticated assets without an image transformation", async () => {
        await uploadBuffer({
            buffer: Buffer.from("%PDF-1.7"),
            kind: "learning-content",
            policy: policyFor(
                "learning-content",
                "application/pdf",
                "authenticated"
            ),
        });
        const { options } = cloudinaryFake.uploads[0];
        expect(options).toMatchObject({
            resource_type: "raw",
            type: "authenticated",
            folder: "samarth-ai/test/learning-content",
        });
        expect(options).not.toHaveProperty("transformation");
    });

    it("never takes the folder or public id from the caller", async () => {
        await uploadBuffer({
            buffer: pngBuffer(),
            kind: "avatars",
            policy: policyFor("avatars", "image/png"),
            folder: "evil",
            publicId: "../x",
        });
        expect(cloudinaryFake.uploads[0].options.folder).toBe(
            "samarth-ai/test/avatars"
        );
        expect(cloudinaryFake.uploads[0].options.public_id).not.toContain("..");
    });

    it("wraps SDK failures as 502 MEDIA_UPLOAD_FAILED and keeps the cause out of the message", async () => {
        cloudinaryFake.uploadError = Object.assign(
            new Error("Invalid API key abc123"),
            { http_code: 401 }
        );
        const failure = await uploadBuffer({
            buffer: pngBuffer(),
            kind: "avatars",
            policy: policyFor("avatars", "image/png"),
        }).catch((error) => error);
        expect(failure).toMatchObject({
            statusCode: 502,
            code: "MEDIA_UPLOAD_FAILED",
            isOperational: true,
        });
        expect(failure.message).not.toContain("abc123");
        expect(failure.cause).toBe(cloudinaryFake.uploadError);
    });
});

describe("createSignedUpload (MEDIA-07, MEDIA-07a)", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    const request = {
        kind: "learning-content",
        mime: "video/mp4",
        bytes: 5_000_000,
        ownerId: "507f1f77bcf86cd799439011",
        now,
    };

    it("returns the params the browser needs and never the API secret", () => {
        const signed = createSignedUpload(request);
        expect(signed).toMatchObject({
            cloudName: env.cloudinary.cloudName,
            apiKey: env.cloudinary.apiKey,
            timestamp: Math.floor(now / 1000),
            folder: "samarth-ai/test/learning-content",
            resourceType: "video",
            type: "upload",
            allowedFormats: "mp4,webm,mov",
            maxBytes: 100 * 1024 * 1024,
        });
        expect(signed.fullPublicId).toBe(`${signed.folder}/${signed.publicId}`);
        expect(JSON.stringify(signed)).not.toContain(env.cloudinary.apiSecret);
    });

    it("signs exactly the server-decided parameters with Cloudinary's algorithm", () => {
        const signed = createSignedUpload(request);
        const toSign = `allowed_formats=${signed.allowedFormats}&folder=${signed.folder}&public_id=${signed.publicId}&timestamp=${signed.timestamp}&type=upload`;
        expect(signed.signature).toBe(
            sha1(`${toSign}${env.cloudinary.apiSecret}`)
        );
    });

    it("signs a different value when any parameter differs", () => {
        const a = createSignedUpload(request);
        const b = createSignedUpload({ ...request, now: now + 1000 });
        expect(a.signature).not.toBe(b.signature);
    });

    it("rejects a disallowed type or oversize declared size before signing", () => {
        expect(() =>
            createSignedUpload({ ...request, mime: "application/x-msdownload" })
        ).toThrowError(
            expect.objectContaining({ code: "MEDIA_TYPE_NOT_ALLOWED" })
        );
        expect(() =>
            createSignedUpload({ ...request, bytes: 101 * 1024 * 1024 })
        ).toThrowError(expect.objectContaining({ code: "MEDIA_TOO_LARGE" }));
    });

    it("marks sensitive kinds as authenticated delivery", () => {
        expect(
            createSignedUpload({
                kind: "certificates",
                mime: "application/pdf",
                bytes: 1000,
                now,
            }).type
        ).toBe("authenticated");
    });
});

describe("fetchAsset (confirm step)", () => {
    it("reads real metadata from Cloudinary", async () => {
        const asset = await fetchAsset({
            publicId: "samarth-ai/test/learning-content/abc",
            resourceType: "video",
            deliveryType: "public",
        });
        expect(asset).toMatchObject({
            resourceType: "video",
            format: "mp4",
            bytes: 2048,
            duration: 12.5,
        });
        expect(cloudinaryFake.resources[0].options).toMatchObject({
            resource_type: "video",
            type: "upload",
        });
    });

    it("maps a missing asset to 404 MEDIA_NOT_FOUND without retrying", async () => {
        cloudinaryFake.resourceError = Object.assign(new Error("not found"), {
            http_code: 404,
        });
        await expect(
            fetchAsset({
                publicId: "x",
                resourceType: "image",
                deliveryType: "public",
            })
        ).rejects.toMatchObject({ statusCode: 404, code: "MEDIA_NOT_FOUND" });
        expect(cloudinaryFake.resources).toHaveLength(1);
    });

    it("retries transient failures with backoff, then reports 502 INTEGRATION_ERROR", async () => {
        vi.useFakeTimers();
        cloudinaryFake.resourceError = Object.assign(new Error("boom"), {
            http_code: 500,
        });
        const outcome = fetchAsset({
            publicId: "x",
            resourceType: "image",
            deliveryType: "public",
        }).catch((error) => error);
        await vi.advanceTimersByTimeAsync(2000);
        expect(await outcome).toMatchObject({
            statusCode: 502,
            code: "INTEGRATION_ERROR",
        });
        expect(cloudinaryFake.resources).toHaveLength(3);
    });
});

describe("deleteAsset (MEDIA-09)", () => {
    it("deletes by stored publicId and resourceType and invalidates the CDN", async () => {
        await expect(
            deleteAsset({
                publicId: "samarth-ai/test/avatars/a",
                resourceType: "image",
                deliveryType: "public",
            })
        ).resolves.toEqual({ deleted: true });
        expect(cloudinaryFake.destroys[0]).toEqual({
            publicId: "samarth-ai/test/avatars/a",
            options: {
                resource_type: "image",
                type: "upload",
                invalidate: true,
            },
        });
    });

    it("uses the authenticated storage type for private assets", async () => {
        await deleteAsset({
            publicId: "p",
            resourceType: "raw",
            deliveryType: "authenticated",
        });
        expect(cloudinaryFake.destroys[0].options).toMatchObject({
            resource_type: "raw",
            type: "authenticated",
        });
    });

    it("reports deleted:false for an asset that was already gone", async () => {
        cloudinaryFake.destroyResult = { result: "not found" };
        await expect(
            deleteAsset({
                publicId: "p",
                resourceType: "image",
                deliveryType: "public",
            })
        ).resolves.toEqual({ deleted: false });
    });

    it("wraps SDK failures after bounded retries", async () => {
        vi.useFakeTimers();
        cloudinaryFake.destroyError = new Error("down");
        const outcome = deleteAsset({
            publicId: "p",
            resourceType: "image",
            deliveryType: "public",
        }).catch((error) => error);
        await vi.advanceTimersByTimeAsync(2000);
        expect(await outcome).toMatchObject({
            statusCode: 502,
            code: "INTEGRATION_ERROR",
        });
        expect(cloudinaryFake.destroys).toHaveLength(3);
    });
});

describe("createAccessUrl (MEDIA-08a)", () => {
    it("builds a short-lived authenticated download URL", () => {
        const now = Date.UTC(2026, 0, 1);
        const url = createAccessUrl({
            publicId: "samarth-ai/test/certificates/c1",
            format: "pdf",
            resourceType: "raw",
            ttlSeconds: 300,
            now,
        });
        expect(url).toContain(`expires_at=${Math.floor(now / 1000) + 300}`);
        expect(url).toContain("type=authenticated");
        expect(url).not.toContain(env.cloudinary.apiSecret);
    });
});

describe("normalizeAsset", () => {
    it("treats anything but authenticated as public", () => {
        expect(
            normalizeAsset({
                public_id: "a",
                resource_type: "image",
                type: "upload",
            }).deliveryType
        ).toBe("public");
        expect(
            normalizeAsset({
                public_id: "a",
                resource_type: "raw",
                type: "authenticated",
            }).deliveryType
        ).toBe("authenticated");
    });
});
