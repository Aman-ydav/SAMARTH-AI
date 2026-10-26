import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { cloudinaryFake } from "#integrations/cloudinary/cloudinary.mock.js";
import { assertUploadFile } from "#integrations/cloudinary/mediaPolicy.mapper.js";
import {
    makeActor,
    makeMediaAttrs,
    newId,
} from "#tests/factories/media.factory.js";
import {
    jpegBuffer,
    makeFile,
    pngBuffer,
} from "#tests/helpers/fileFixtures.js";
import {
    clearCollections,
    startTestDb,
    stopTestDb,
} from "#tests/helpers/testDb.js";
import { User } from "#modules/users/index.js";
import { Media } from "./media.model.js";
import { removeAvatar, setAvatar, usersPort } from "./mediaAvatar.service.js";

vi.mock("cloudinary", async (importOriginal) =>
    (
        await import("#integrations/cloudinary/cloudinary.mock.js")
    ).buildMockedCloudinaryModule(await importOriginal())
);

const NOW = new Date("2026-10-26T10:00:00.000Z");
const withDeleted = (filter) =>
    Media.findOne(filter).setOptions({ withDeleted: true });
const upload = (buffer = pngBuffer(), name = "me.png", type = "image/png") => {
    const file = makeFile({ originalname: name, mimetype: type, buffer });
    return { file, policy: assertUploadFile({ kind: "avatars", file }) };
};
const SUMMARY = { id: "u1", name: "Test User" };

/** Fake users port: remembers the avatar so replace/clear behave like the real module. */
function fakeUsers(initial = null) {
    const state = { avatar: initial };
    vi.spyOn(usersPort, "replaceAvatar").mockImplementation(
        async ({ avatar }) => {
            const previousAvatar = state.avatar;
            state.avatar = avatar;
            return { user: { ...SUMMARY, avatar }, previousAvatar };
        }
    );
    vi.spyOn(usersPort, "clearAvatar").mockImplementation(async () => {
        const previousAvatar = state.avatar;
        state.avatar = null;
        return { user: { ...SUMMARY, avatar: null }, previousAvatar };
    });
    return state;
}

describe("mediaAvatar.service (EDGE-108, MEDIA-10, MEDIA-11)", () => {
    beforeAll(async () => {
        await startTestDb();
        await Media.init();
    });
    afterAll(stopTestDb);
    beforeEach(async () => {
        await clearCollections();
        cloudinaryFake.reset();
    });

    it("uploads with force_strip into the avatars folder, records a ready media row and updates the user", async () => {
        const state = fakeUsers();
        const user = makeActor({ role: "learner" });
        const result = await setAvatar({ user, upload: upload(), now: NOW });

        expect(cloudinaryFake.uploads).toHaveLength(1);
        const { options } = cloudinaryFake.uploads[0];
        expect(options).toMatchObject({
            folder: "samarth-ai/test/avatars",
            resource_type: "image",
            type: "upload",
            allowed_formats: "jpg,png,webp",
            transformation: [{ flags: "force_strip" }],
        });
        expect(options.public_id.startsWith(`${user.id}_`)).toBe(true);

        const record = await Media.findOne({ ownerId: user.id }).lean();
        expect(record).toMatchObject({
            kind: "avatars",
            status: "ready",
            resourceType: "image",
            deliveryType: "public",
            format: "png",
            confirmedAt: NOW,
        });
        expect(String(record.orgId)).toBe(user.orgId);
        expect(record.expiresAt).toBeUndefined();

        expect(usersPort.replaceAvatar).toHaveBeenCalledWith({
            userId: user.id,
            avatar: {
                publicId: record.publicId,
                url: "https://media.example.test/asset",
                bytes: pngBuffer().length,
                format: "png",
                width: 100,
                height: 100,
                version: 1700000000,
            },
        });
        expect(state.avatar.publicId).toBe(record.publicId);
        expect(result).toMatchObject({
            id: "u1",
            avatar: { publicId: record.publicId },
        });
        expect(cloudinaryFake.destroys).toHaveLength(0);
    });

    it("replaces an avatar: the old asset is deleted by stored publicId and its record retired", async () => {
        const user = makeActor();
        const old = await Media.create(
            makeMediaAttrs({
                kind: "avatars",
                resourceType: "image",
                format: "png",
                ownerId: user.id,
                orgId: user.orgId,
            })
        );
        fakeUsers({ publicId: old.publicId });

        await setAvatar({
            user,
            upload: upload(jpegBuffer(), "a.jpg", "image/jpeg"),
            now: NOW,
        });

        expect(cloudinaryFake.destroys).toHaveLength(1);
        expect(cloudinaryFake.destroys[0]).toMatchObject({
            publicId: old.publicId,
            options: {
                resource_type: "image",
                type: "upload",
                invalidate: true,
            },
        });
        const retired = await withDeleted({ _id: old._id });
        expect(retired).toMatchObject({ status: "deleted", purgedAt: NOW });
        expect(
            await Media.countDocuments({ ownerId: user.id, status: "ready" })
        ).toBe(1);
    });

    it("also deletes a legacy avatar that has no media row", async () => {
        fakeUsers({ publicId: "samarth-ai/test/avatars/legacy" });
        await setAvatar({ user: makeActor(), upload: upload() });
        expect(cloudinaryFake.destroys.map((d) => d.publicId)).toEqual([
            "samarth-ai/test/avatars/legacy",
        ]);
    });

    it("keeps the old avatar when the upload fails: nothing is recorded and the user is untouched", async () => {
        const state = fakeUsers({ publicId: "old/one" });
        cloudinaryFake.uploadError = new Error("sdk boom");
        await expect(
            setAvatar({ user: makeActor(), upload: upload() })
        ).rejects.toMatchObject({
            code: "MEDIA_UPLOAD_FAILED",
            statusCode: 502,
        });
        expect(usersPort.replaceAvatar).not.toHaveBeenCalled();
        expect(state.avatar.publicId).toBe("old/one");
        expect(await Media.countDocuments()).toBe(0);
        expect(cloudinaryFake.destroys).toHaveLength(0);
    });

    it("removes the NEW asset and record when the user update fails, and never touches the old one", async () => {
        fakeUsers({ publicId: "old/one" });
        usersPort.replaceAvatar.mockRejectedValueOnce(new Error("db down"));
        await expect(
            setAvatar({ user: makeActor(), upload: upload(), now: NOW })
        ).rejects.toThrow("db down");
        const created = cloudinaryFake.uploads[0].options;
        expect(cloudinaryFake.destroys).toHaveLength(1);
        expect(cloudinaryFake.destroys[0].publicId).toBe(
            `${created.folder}/${created.public_id}`
        );
        const record = await withDeleted({});
        expect(record).toMatchObject({ status: "deleted", purgedAt: NOW });
    });

    it("removes the new asset when the media row cannot be saved", async () => {
        fakeUsers();
        vi.spyOn(Media, "create").mockRejectedValueOnce(
            new Error("insert failed")
        );
        await expect(
            setAvatar({ user: makeActor(), upload: upload() })
        ).rejects.toThrow("insert failed");
        expect(usersPort.replaceAvatar).not.toHaveBeenCalled();
        expect(cloudinaryFake.destroys).toHaveLength(1);
    });

    it("reports the original error even when the rollback itself fails", async () => {
        fakeUsers();
        usersPort.replaceAvatar.mockRejectedValueOnce(new Error("db down"));
        vi.spyOn(Media, "findOneAndUpdate").mockRejectedValueOnce(
            new Error("rollback failed")
        );
        await expect(
            setAvatar({ user: makeActor(), upload: upload() })
        ).rejects.toThrow("db down");
    });

    it("still succeeds when the old asset cannot be deleted (MEDIA-11): the sweep retries later", async () => {
        const user = makeActor();
        const old = await Media.create(
            makeMediaAttrs({
                kind: "avatars",
                resourceType: "image",
                ownerId: user.id,
                orgId: user.orgId,
            })
        );
        fakeUsers({ publicId: old.publicId });
        cloudinaryFake.destroyError = { http_code: 404 };
        await expect(
            setAvatar({ user, upload: upload(), now: NOW })
        ).resolves.toMatchObject({ id: "u1" });
        const retired = await withDeleted({ _id: old._id });
        expect(retired).toMatchObject({ status: "deleted", purgedAt: null });
    });

    it("still succeeds when retiring the old record fails in the database", async () => {
        const old = newId();
        fakeUsers({ publicId: `samarth-ai/test/avatars/${old}` });
        vi.spyOn(Media, "findOneAndUpdate").mockRejectedValueOnce(
            new Error("db blip")
        );
        await expect(
            setAvatar({ user: makeActor(), upload: upload() })
        ).resolves.toMatchObject({ id: "u1" });
    });

    it("removeAvatar deletes the current asset and returns the user", async () => {
        const user = makeActor();
        const old = await Media.create(
            makeMediaAttrs({
                kind: "avatars",
                resourceType: "image",
                ownerId: user.id,
                orgId: user.orgId,
            })
        );
        fakeUsers({ publicId: old.publicId });
        const result = await removeAvatar({ user, now: NOW });
        expect(result).toEqual({ ...SUMMARY, avatar: null });
        expect(cloudinaryFake.destroys.map((d) => d.publicId)).toEqual([
            old.publicId,
        ]);
        expect((await withDeleted({ _id: old._id })).status).toBe("deleted");
    });

    it("removeAvatar without an avatar is a no-op that still returns the user (idempotent)", async () => {
        fakeUsers(null);
        const user = makeActor();
        const first = await removeAvatar({ user });
        const second = await removeAvatar({ user });
        expect(second).toEqual(first);
        expect(cloudinaryFake.destroys).toHaveLength(0);
    });

    describe("default users port (writes users.avatar through the users module)", () => {
        const avatar = (publicId) => ({
            publicId,
            url: "https://media.example.test/a",
            bytes: 10,
            format: "png",
            width: 5,
            height: 5,
            version: 3,
        });
        const makeUser = (overrides = {}) =>
            User.create({
                orgId: newId(),
                email: `${newId()}@example.test`,
                name: "Avatar Tester",
                role: "learner",
                status: "active",
                ...overrides,
            });

        it("replaceAvatar swaps atomically and reports the previous avatar and the user summary", async () => {
            const user = await makeUser();
            const first = await usersPort.replaceAvatar({
                userId: user.id,
                avatar: avatar("a/1"),
            });
            expect(first.previousAvatar).toBeNull();
            expect(first.user).toMatchObject({
                id: user.id,
                avatar: { publicId: "a/1", version: 3 },
            });

            const second = await usersPort.replaceAvatar({
                userId: user.id,
                avatar: avatar("a/2"),
            });
            expect(second.previousAvatar).toMatchObject({ publicId: "a/1" });
            expect(second.user.avatar.publicId).toBe("a/2");
            expect(second.user).not.toHaveProperty("passwordHash");
        });

        it("clearAvatar removes it, is idempotent, and rejects unknown users with 404", async () => {
            const user = await makeUser({ avatar: avatar("a/1") });
            const cleared = await usersPort.clearAvatar({ userId: user.id });
            expect(cleared.previousAvatar).toMatchObject({ publicId: "a/1" });
            expect(cleared.user.avatar).toBeNull();
            const again = await usersPort.clearAvatar({ userId: user.id });
            expect(again.previousAvatar).toBeNull();
            await expect(
                usersPort.clearAvatar({ userId: newId() })
            ).rejects.toMatchObject({ statusCode: 404 });
            await expect(
                usersPort.replaceAvatar({
                    userId: newId(),
                    avatar: avatar("a/3"),
                })
            ).rejects.toMatchObject({ statusCode: 404 });
        });

        it("refuses an avatar without a publicId (the users schema validates it)", async () => {
            const user = await makeUser();
            await expect(
                usersPort.replaceAvatar({
                    userId: user.id,
                    avatar: { url: "https://media.example.test/a" },
                })
            ).rejects.toMatchObject({ name: "ValidationError" });
        });
    });
});
