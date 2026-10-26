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
    makeMediaAttrs,
    makePendingAttrs,
    newId,
} from "#tests/factories/media.factory.js";
import {
    clearCollections,
    startTestDb,
    stopTestDb,
} from "#tests/helpers/testDb.js";
import { Media } from "./media.model.js";
import {
    deleteMedia,
    findReadyMedia,
    getMediaAccessUrl,
} from "./mediaAccess.service.js";

vi.mock("cloudinary", async (importOriginal) =>
    (
        await import("#integrations/cloudinary/cloudinary.mock.js")
    ).buildMockedCloudinaryModule(await importOriginal())
);

const NOW = new Date("2026-10-26T10:00:00.000Z");
const withDeleted = (id) =>
    Media.findById(id).setOptions({ withDeleted: true });
const failure = (code, statusCode) =>
    expect.objectContaining({ code, statusCode });

describe("mediaAccess.service", () => {
    beforeAll(async () => {
        await startTestDb();
        await Media.init();
    });
    afterAll(stopTestDb);
    beforeEach(async () => {
        await clearCollections();
        cloudinaryFake.reset();
    });

    describe("getMediaAccessUrl (MEDIA-08a)", () => {
        const secretDoc = (overrides = {}) =>
            Media.create(
                makeMediaAttrs({
                    resourceType: "raw",
                    deliveryType: "authenticated",
                    format: "pdf",
                    ...overrides,
                })
            );

        it("gives the owner a five-minute signed download link without exposing the secret", async () => {
            const user = makeActor();
            const doc = await secretDoc({
                ownerId: user.id,
                orgId: user.orgId,
            });
            const result = await getMediaAccessUrl({
                user,
                id: String(doc._id),
                now: NOW,
            });

            const url = new URL(result.url);
            expect(url.searchParams.get("public_id")).toBe(doc.publicId);
            expect(url.searchParams.get("type")).toBe("authenticated");
            expect(Number(url.searchParams.get("expires_at"))).toBe(
                Math.floor(NOW.getTime() / 1000) + 300
            );
            expect(result.url).not.toContain(env.cloudinary.apiSecret);
            expect(result.expiresAt).toBe("2026-10-26T10:05:00.000Z");
            expect(result.mediaId).toBe(String(doc._id));
        });

        it("lets an admin or superadmin of the same organisation read it", async () => {
            const owner = makeActor();
            const doc = await secretDoc({
                ownerId: owner.id,
                orgId: owner.orgId,
            });
            for (const role of ["admin", "superadmin"])
                await expect(
                    getMediaAccessUrl({
                        user: makeActor({ role, orgId: owner.orgId }),
                        id: String(doc._id),
                    })
                ).resolves.toHaveProperty("url");
        });

        it("answers 404 for another user, a trainer colleague, or an admin of another organisation (IDOR)", async () => {
            const owner = makeActor();
            const doc = await secretDoc({
                ownerId: owner.id,
                orgId: owner.orgId,
            });
            const strangers = [
                makeActor({ orgId: owner.orgId, role: "learner" }),
                makeActor({ orgId: owner.orgId, role: "trainer" }),
                makeActor({ role: "admin" }),
                makeActor({ role: "superadmin" }),
            ];
            for (const user of strangers)
                await expect(
                    getMediaAccessUrl({ user, id: String(doc._id) })
                ).rejects.toEqual(failure("MEDIA_NOT_FOUND", 404));
        });

        it("answers 404 for pending and deleted records and 400 for a bad id", async () => {
            const user = makeActor();
            const pending = await secretDoc({
                ownerId: user.id,
                orgId: user.orgId,
                status: "pending",
            });
            const gone = await secretDoc({
                ownerId: user.id,
                orgId: user.orgId,
                status: "deleted",
                deletedAt: NOW,
            });
            for (const doc of [pending, gone])
                await expect(
                    getMediaAccessUrl({ user, id: String(doc._id) })
                ).rejects.toEqual(failure("MEDIA_NOT_FOUND", 404));
            await expect(getMediaAccessUrl({ user, id: "x" })).rejects.toEqual(
                failure("INVALID_ID", 400)
            );
        });

        it("refuses public assets with 422 (they are rendered from their publicId, MEDIA-14)", async () => {
            const user = makeActor();
            const doc = await Media.create(
                makeMediaAttrs({ ownerId: user.id, orgId: user.orgId })
            );
            await expect(
                getMediaAccessUrl({ user, id: String(doc._id) })
            ).rejects.toEqual(failure("UNPROCESSABLE", 422));
        });
    });

    describe("deleteMedia (MEDIA-09, MEDIA-11)", () => {
        it("soft-deletes first, then deletes the Cloudinary asset by stored publicId and resource type", async () => {
            const user = makeActor();
            const doc = await Media.create(
                makeMediaAttrs({ ownerId: user.id, orgId: user.orgId })
            );
            const result = await deleteMedia({
                user,
                id: String(doc._id),
                now: NOW,
            });
            expect(result).toEqual({ id: String(doc._id), status: "deleted" });

            const stored = await withDeleted(doc._id);
            expect(stored).toMatchObject({
                status: "deleted",
                deletedAt: NOW,
                purgedAt: NOW,
            });
            expect(cloudinaryFake.destroys).toEqual([
                {
                    publicId: doc.publicId,
                    options: expect.objectContaining({
                        resource_type: "video",
                        type: "upload",
                        invalidate: true,
                    }),
                },
            ]);
        });

        it("a second delete is 404 and calls Cloudinary only once", async () => {
            const user = makeActor();
            const doc = await Media.create(
                makeMediaAttrs({ ownerId: user.id, orgId: user.orgId })
            );
            await deleteMedia({ user, id: String(doc._id) });
            await expect(
                deleteMedia({ user, id: String(doc._id) })
            ).rejects.toEqual(failure("MEDIA_NOT_FOUND", 404));
            expect(cloudinaryFake.destroys).toHaveLength(1);
        });

        it("still succeeds when Cloudinary fails: the row stays unpurged for the sweep (MEDIA-11)", async () => {
            const user = makeActor();
            const doc = await Media.create(
                makeMediaAttrs({ ownerId: user.id, orgId: user.orgId })
            );
            cloudinaryFake.destroyError = { http_code: 404 };
            await expect(
                deleteMedia({ user, id: String(doc._id), now: NOW })
            ).resolves.toMatchObject({ status: "deleted" });
            expect((await withDeleted(doc._id)).purgedAt).toBeNull();
        });

        it("answers 404 for non-owners and other organisations, but lets a same-org admin delete (IDOR)", async () => {
            const owner = makeActor();
            const doc = await Media.create(
                makeMediaAttrs({ ownerId: owner.id, orgId: owner.orgId })
            );
            for (const stranger of [
                makeActor({ orgId: owner.orgId, role: "trainer" }),
                makeActor({ role: "admin" }),
            ])
                await expect(
                    deleteMedia({ user: stranger, id: String(doc._id) })
                ).rejects.toEqual(failure("MEDIA_NOT_FOUND", 404));
            expect(cloudinaryFake.destroys).toHaveLength(0);

            await expect(
                deleteMedia({
                    user: makeActor({ orgId: owner.orgId, role: "admin" }),
                    id: String(doc._id),
                })
            ).resolves.toMatchObject({ status: "deleted" });
        });

        it("refuses to delete an avatar record here (409): avatars go through DELETE /me/avatar", async () => {
            const user = makeActor();
            const doc = await Media.create(
                makeMediaAttrs({
                    kind: "avatars",
                    resourceType: "image",
                    ownerId: user.id,
                    orgId: user.orgId,
                })
            );
            await expect(
                deleteMedia({ user, id: String(doc._id) })
            ).rejects.toEqual(failure("CONFLICT", 409));
            expect(cloudinaryFake.destroys).toHaveLength(0);
        });

        it("answers 400 for a malformed id", async () => {
            await expect(
                deleteMedia({ user: makeActor(), id: "zzz" })
            ).rejects.toEqual(failure("INVALID_ID", 400));
        });
    });

    describe("findReadyMedia", () => {
        it("returns the owner's ready record as a DTO and 404 for everything else", async () => {
            const user = makeActor();
            const ready = await Media.create(
                makeMediaAttrs({ ownerId: user.id, orgId: user.orgId })
            );
            const pending = await Media.create(
                makePendingAttrs({ ownerId: user.id, orgId: user.orgId })
            );
            await expect(
                findReadyMedia({ user, id: String(ready._id) })
            ).resolves.toMatchObject({
                id: String(ready._id),
                status: "ready",
            });
            for (const [who, id] of [
                [user, String(pending._id)],
                [makeActor({ orgId: user.orgId }), String(ready._id)],
                [user, newId()],
            ])
                await expect(findReadyMedia({ user: who, id })).rejects.toEqual(
                    failure("MEDIA_NOT_FOUND", 404)
                );
        });
    });
});
