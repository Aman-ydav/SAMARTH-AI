import { createHash } from "node:crypto";
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { env } from "#config/env.js";
import { cloudinaryFake } from "#integrations/cloudinary/cloudinary.mock.js";
import {
    makeActor,
    makeCloudinaryAsset,
    newId,
} from "#tests/factories/media.factory.js";
import {
    clearCollections,
    startTestDb,
    stopTestDb,
} from "#tests/helpers/testDb.js";
import { Media } from "./media.model.js";
import {
    confirmMediaUpload,
    requestMediaSignature,
    toPublicMedia,
} from "./media.service.js";

vi.mock("cloudinary", async (importOriginal) =>
    (
        await import("#integrations/cloudinary/cloudinary.mock.js")
    ).buildMockedCloudinaryModule(await importOriginal())
);

const NOW = new Date("2026-10-26T10:00:00.000Z");
const MB = 1024 * 1024;
const sha1 = (text) => createHash("sha1").update(text).digest("hex");
const withDeleted = (id) =>
    Media.findById(id).setOptions({ withDeleted: true });
const video = (overrides = {}) => ({
    kind: "learning-content",
    resourceType: "video",
    contentType: "video/mp4",
    bytes: 5 * MB,
    ...overrides,
});
const pdf = (overrides = {}) =>
    video({
        resourceType: "raw",
        contentType: "application/pdf",
        bytes: MB,
        ...overrides,
    });
const sign = (user, input) => requestMediaSignature({ user, input, now: NOW });
const failure = (code, statusCode) =>
    expect.objectContaining({ code, statusCode });

describe("media.service", () => {
    beforeAll(async () => {
        await startTestDb();
        await Media.init();
    });
    afterAll(stopTestDb);
    beforeEach(async () => {
        await clearCollections();
        cloudinaryFake.reset();
    });

    describe("requestMediaSignature (MEDIA-07, MEDIA-07a)", () => {
        it("signs only server-decided params, never leaks the secret, and records a pending upload", async () => {
            const user = makeActor();
            const result = await sign(user, video({ filename: "Intro.MP4" }));

            const signed = `allowed_formats=${result.allowedFormats}&folder=${result.folder}&public_id=${result.publicId}&timestamp=${result.timestamp}&type=upload`;
            expect(result.signature).toBe(
                sha1(`${signed}${env.cloudinary.apiSecret}`)
            );
            expect(result).toMatchObject({
                cloudName: env.cloudinary.cloudName,
                apiKey: env.cloudinary.apiKey,
                folder: "samarth-ai/test/learning-content",
                allowedFormats: "mp4,webm,mov",
                resourceType: "video",
                type: "upload",
                maxBytes: 100 * MB,
                timestamp: Math.floor(NOW.getTime() / 1000),
                expiresAt: "2026-10-26T11:00:00.000Z",
            });
            expect(result.uploadParams).toEqual({
                api_key: env.cloudinary.apiKey,
                timestamp: result.timestamp,
                signature: result.signature,
                folder: result.folder,
                public_id: result.publicId,
                allowed_formats: result.allowedFormats,
                type: "upload",
            });
            expect(JSON.stringify(result)).not.toContain(
                env.cloudinary.apiSecret
            );

            const record = await Media.findById(result.mediaId).lean();
            expect(record).toMatchObject({
                status: "pending",
                kind: "learning-content",
                resourceType: "video",
                deliveryType: "public",
                declaredBytes: 5 * MB,
                declaredFormat: "mp4",
                publicId: `${result.folder}/${result.publicId}`,
            });
            expect(String(record.ownerId)).toBe(user.id);
            expect(String(record.orgId)).toBe(user.orgId);
            expect(record.expiresAt.getTime()).toBe(
                NOW.getTime() + 48 * 3600 * 1000
            );
        });

        it("chooses the public id itself: the client filename never reaches it (MEDIA-04a)", async () => {
            const result = await sign(
                makeActor(),
                video({ filename: "evil name.mp4" })
            );
            expect(result.publicId).not.toMatch(/evil|\.mp4|\s/);
            expect(result.publicId).toMatch(/^[a-f0-9]{24}_[\w-]{16,}$/);
        });

        it("uses authenticated delivery for documents", async () => {
            const result = await sign(makeActor(), pdf());
            expect(result).toMatchObject({
                type: "authenticated",
                resourceType: "raw",
            });
            expect((await Media.findById(result.mediaId)).deliveryType).toBe(
                "authenticated"
            );
        });

        it.each([
            ["learner", "learning-content"],
            ["learner", "temp"],
            ["trainer", "marketing"],
            ["trainer", "avatars"],
            ["admin", "avatars"],
            ["admin", "certificates"],
            ["superadmin", "certificates"],
        ])(
            "forbids a %s from requesting %s uploads (403 FORBIDDEN)",
            async (role, kind) => {
                const input = video({ kind });
                await expect(sign(makeActor({ role }), input)).rejects.toEqual(
                    failure("FORBIDDEN", 403)
                );
                expect(await Media.countDocuments()).toBe(0);
            }
        );

        it("lets admins request marketing video and trainers learning content", async () => {
            await expect(
                sign(
                    makeActor({ role: "admin" }),
                    video({ kind: "marketing", contentType: "video/webm" })
                )
            ).resolves.toMatchObject({ folder: "samarth-ai/test/marketing" });
            await expect(
                sign(makeActor({ role: "trainer" }), pdf())
            ).resolves.toBeDefined();
        });

        it.each([
            [
                "svg",
                video({ resourceType: "image", contentType: "image/svg+xml" }),
            ],
            ["gif", video({ resourceType: "image", contentType: "image/gif" })],
            [
                "executable",
                video({
                    resourceType: "raw",
                    contentType: "application/x-msdownload",
                }),
            ],
            [
                "image in a kind without images",
                video({ resourceType: "image", contentType: "image/png" }),
            ],
            ["html", video({ resourceType: "raw", contentType: "text/html" })],
        ])(
            "rejects %s with 400 MEDIA_TYPE_NOT_ALLOWED and creates nothing",
            async (_label, input) => {
                await expect(sign(makeActor(), input)).rejects.toEqual(
                    failure("MEDIA_TYPE_NOT_ALLOWED", 400)
                );
                expect(await Media.countDocuments()).toBe(0);
            }
        );

        it("rejects a resource type that does not match the file type", async () => {
            await expect(
                sign(makeActor(), video({ resourceType: "image" }))
            ).rejects.toEqual(failure("MEDIA_TYPE_NOT_ALLOWED", 400));
        });

        it("rejects a filename whose extension does not match the content type", async () => {
            await expect(
                sign(makeActor(), video({ filename: "movie.exe" }))
            ).rejects.toEqual(failure("MEDIA_TYPE_NOT_ALLOWED", 400));
            expect(await Media.countDocuments()).toBe(0);
        });

        it("rejects oversize files per kind with 413 MEDIA_TOO_LARGE", async () => {
            await expect(
                sign(makeActor(), video({ bytes: 100 * MB + 1 }))
            ).rejects.toEqual(failure("MEDIA_TOO_LARGE", 413));
            await expect(
                sign(makeActor(), pdf({ bytes: 10 * MB + 1 }))
            ).rejects.toEqual(failure("MEDIA_TOO_LARGE", 413));
            await expect(
                sign(makeActor(), video({ bytes: 100 * MB }))
            ).resolves.toBeDefined();
        });

        it("rejects a zero-byte file with 400 UPLOAD_INVALID", async () => {
            await expect(
                sign(makeActor(), video({ bytes: 0 }))
            ).rejects.toEqual(failure("UPLOAD_INVALID", 400));
        });
    });

    describe("confirmMediaUpload (MEDIA-07, MEDIA-07d)", () => {
        async function signed(user, input = video()) {
            const result = await sign(user, input);
            return Media.findById(result.mediaId);
        }
        const asset = (record, overrides) => {
            cloudinaryFake.resourceResult = makeCloudinaryAsset(
                record,
                overrides
            );
        };

        it("marks the record ready with the facts Cloudinary reports, not what the client declared", async () => {
            const user = makeActor();
            const record = await signed(user, video({ bytes: 5 }));
            asset(record, { bytes: 4096 });

            const dto = await confirmMediaUpload({
                user,
                mediaId: String(record._id),
                now: NOW,
            });
            expect(dto).toEqual({
                id: String(record._id),
                kind: "learning-content",
                publicId: record.publicId,
                resourceType: "video",
                deliveryType: "public",
                format: "mp4",
                bytes: 4096,
                width: 1280,
                height: 720,
                duration: 12.5,
                version: 1700000002,
                status: "ready",
            });
            const stored = await Media.findById(record._id).lean();
            expect(stored.confirmedAt).toEqual(NOW);
            expect(stored.expiresAt).toBeUndefined();
            expect(stored.secureUrl).toMatch(/^https:/);
            expect(cloudinaryFake.resources).toHaveLength(1);
            expect(cloudinaryFake.resources[0]).toMatchObject({
                publicId: record.publicId,
                options: { resource_type: "video", type: "upload" },
            });
        });

        it("can confirm by the full publicId", async () => {
            const user = makeActor();
            const record = await signed(user);
            asset(record);
            const dto = await confirmMediaUpload({
                user,
                publicId: record.publicId,
                now: NOW,
            });
            expect(dto.status).toBe("ready");
        });

        it("is safe to replay: a second confirm returns the ready record without asking Cloudinary again", async () => {
            const user = makeActor();
            const record = await signed(user);
            asset(record);
            const first = await confirmMediaUpload({
                user,
                mediaId: String(record._id),
            });
            const second = await confirmMediaUpload({
                user,
                mediaId: String(record._id),
            });
            expect(second).toEqual(first);
            expect(cloudinaryFake.resources).toHaveLength(1);
        });

        it("survives two concurrent confirms (the loser answers with the winner's record)", async () => {
            const user = makeActor();
            const record = await signed(user);
            asset(record);
            const [a, b] = await Promise.all([
                confirmMediaUpload({ user, mediaId: String(record._id) }),
                confirmMediaUpload({ user, mediaId: String(record._id) }),
            ]);
            expect(a.status).toBe("ready");
            expect(b).toEqual(a);
        });

        it("answers 404 MEDIA_NOT_FOUND when the browser never uploaded, and keeps the record pending", async () => {
            const user = makeActor();
            const record = await signed(user);
            cloudinaryFake.resourceError = { http_code: 404 };
            await expect(
                confirmMediaUpload({ user, mediaId: String(record._id) })
            ).rejects.toEqual(failure("MEDIA_NOT_FOUND", 404));
            expect((await Media.findById(record._id)).status).toBe("pending");
        });

        it("maps a Cloudinary outage to 502 INTEGRATION_ERROR and keeps the record pending for a retry", async () => {
            const user = makeActor();
            const record = await signed(user);
            cloudinaryFake.resourceError = { http_code: 500 };
            await expect(
                confirmMediaUpload({ user, mediaId: String(record._id) })
            ).rejects.toEqual(failure("INTEGRATION_ERROR", 502));
            expect((await Media.findById(record._id)).status).toBe("pending");
        });

        it("deletes an oversize asset and rejects with 413 MEDIA_TOO_LARGE (MEDIA-07d)", async () => {
            const user = makeActor();
            const record = await signed(user);
            asset(record, { bytes: 100 * MB + 1 });
            await expect(
                confirmMediaUpload({ user, mediaId: String(record._id) })
            ).rejects.toEqual(failure("MEDIA_TOO_LARGE", 413));
            expect(cloudinaryFake.destroys.map((d) => d.publicId)).toEqual([
                record.publicId,
            ]);
            expect((await withDeleted(record._id)).status).toBe("deleted");
        });

        it.each([
            ["a disallowed format", { format: "exe" }],
            ["a format that differs from the declared one", { format: "webm" }],
            [
                "a different resource type",
                { resource_type: "image", format: "png" },
            ],
            ["a different delivery type", { type: "authenticated" }],
            ["a missing format on a video", { format: undefined }],
        ])(
            "deletes the asset and rejects %s with MEDIA_TYPE_NOT_ALLOWED",
            async (_label, patch) => {
                const user = makeActor();
                const record = await signed(user);
                asset(record, patch);
                await expect(
                    confirmMediaUpload({ user, mediaId: String(record._id) })
                ).rejects.toEqual(failure("MEDIA_TYPE_NOT_ALLOWED", 400));
                expect(cloudinaryFake.destroys).toHaveLength(1);
                expect((await withDeleted(record._id)).status).toBe("deleted");
            }
        );

        it("rejects an asset outside the expected folder (tampered public id) and zero bytes with UPLOAD_INVALID", async () => {
            const user = makeActor();
            const record = await signed(user);
            asset(record, {
                public_id: "samarth-ai/prod/learning-content/other",
            });
            await expect(
                confirmMediaUpload({ user, mediaId: String(record._id) })
            ).rejects.toEqual(failure("UPLOAD_INVALID", 400));

            const second = await signed(user);
            asset(second, { bytes: 0 });
            await expect(
                confirmMediaUpload({ user, mediaId: String(second._id) })
            ).rejects.toEqual(failure("UPLOAD_INVALID", 400));
        });

        it("accepts a raw document that Cloudinary reports without a format, using the declared one", async () => {
            const user = makeActor();
            const record = await signed(user, pdf());
            asset(record, { format: undefined, type: "authenticated" });
            const dto = await confirmMediaUpload({
                user,
                mediaId: String(record._id),
            });
            expect(dto).toMatchObject({
                status: "ready",
                format: "pdf",
                deliveryType: "authenticated",
                resourceType: "raw",
            });
        });

        it("answers 404 for another user's or another organisation's record (IDOR)", async () => {
            const owner = makeActor();
            const record = await signed(owner);
            asset(record);
            for (const stranger of [
                makeActor({ orgId: owner.orgId }),
                makeActor({ id: owner.id }),
            ])
                await expect(
                    confirmMediaUpload({
                        user: stranger,
                        mediaId: String(record._id),
                    })
                ).rejects.toEqual(failure("MEDIA_NOT_FOUND", 404));
            expect(cloudinaryFake.resources).toHaveLength(0);
        });

        it("answers 400 INVALID_ID for a malformed id and 404 for a well-formed unknown one", async () => {
            const user = makeActor();
            await expect(
                confirmMediaUpload({ user, mediaId: "not-an-id" })
            ).rejects.toEqual(failure("INVALID_ID", 400));
            await expect(
                confirmMediaUpload({ user, mediaId: newId() })
            ).rejects.toEqual(failure("MEDIA_NOT_FOUND", 404));
        });

        it("answers 404 when the record disappeared during a lost confirm race", async () => {
            const user = makeActor();
            const record = await signed(user);
            asset(record);
            vi.spyOn(Media, "findOneAndUpdate").mockResolvedValueOnce(null);
            vi.spyOn(Media, "findById").mockResolvedValueOnce(null);
            await expect(
                confirmMediaUpload({ user, mediaId: String(record._id) })
            ).rejects.toEqual(failure("MEDIA_NOT_FOUND", 404));
        });

        it("re-checks the role: a user demoted after signing gets 403", async () => {
            const user = makeActor();
            const record = await signed(user);
            await expect(
                confirmMediaUpload({
                    user: { ...user, role: "learner" },
                    mediaId: String(record._id),
                })
            ).rejects.toEqual(failure("FORBIDDEN", 403));
        });
    });

    describe("toPublicMedia", () => {
        it("exposes an allowlist only and nulls missing facts", () => {
            const dto = toPublicMedia({
                _id: "abc",
                kind: "temp",
                publicId: "p",
                resourceType: "image",
                deliveryType: "public",
                status: "pending",
                ownerId: "secret-owner",
                orgId: "secret-org",
                secureUrl: "https://media.example.test/x",
            });
            expect(Object.keys(dto).sort()).toEqual([
                "bytes",
                "deliveryType",
                "duration",
                "format",
                "height",
                "id",
                "kind",
                "publicId",
                "resourceType",
                "status",
                "version",
                "width",
            ]);
            expect(dto).toMatchObject({
                id: "abc",
                bytes: null,
                duration: null,
            });
        });
    });
});
