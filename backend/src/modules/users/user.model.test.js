import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { makeUser } from "#tests/factories/user.factory.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { User } from "./user.model.js";

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

const indexesByName = async () =>
    Object.fromEntries(
        (await User.collection.indexes()).map((index) => [index.name, index])
    );

describe("User model indexes (DB-20, DB-22)", () => {
    it("declares the named indexes from the register", async () => {
        const indexes = await indexesByName();
        expect(indexes.users_email_uq).toMatchObject({
            unique: true,
            key: { email: 1 },
        });
        expect(indexes.users_googleSub_uq).toMatchObject({
            unique: true,
            partialFilterExpression: { googleSub: { $type: "string" } },
        });
        expect(indexes.users_orgId_role_status.key).toEqual({
            orgId: 1,
            role: 1,
            status: 1,
        });
        expect(indexes.users_orgId_createdAt.key).toEqual({
            orgId: 1,
            createdAt: -1,
        });
        expect(indexes.users_status_deletionScheduledAt.key).toEqual({
            status: 1,
            deletionScheduledAt: 1,
        });
    });

    it("refuses a second user with the same email (the duplicate-key error is the exists path)", async () => {
        await User.create(makeUser({ email: "dup@example.test" }));
        await expect(
            User.create(makeUser({ email: "dup@example.test" }))
        ).rejects.toMatchObject({ code: 11000 });
    });

    it("allows many users without a googleSub but refuses a repeated googleSub", async () => {
        await User.create([
            makeUser(),
            makeUser(),
            makeUser({ googleSub: "sub-1" }),
        ]);
        await expect(
            User.create(makeUser({ googleSub: "sub-1" }))
        ).rejects.toMatchObject({ code: 11000 });
    });
});

describe("User model fields", () => {
    it("normalises the email (trim, NFKC, lowercase)", async () => {
        const user = await User.create(
            makeUser({ email: "  ＵＳＥＲ@Example.TEST " })
        );
        expect(user.email).toBe("user@example.test");
    });

    it("applies the documented defaults", async () => {
        const user = await User.create({
            orgId: makeUser().orgId,
            email: "defaults@example.test",
            name: "Defaults",
        });
        expect(user).toMatchObject({
            role: "learner",
            status: "pending_verification",
            tokenVersion: 0,
            failedLoginCount: 0,
            lockoutCount: 0,
            lockUntil: null,
            lastLoginAt: null,
            mustChangePassword: false,
            emailVerified: false,
            locale: "en",
            timezone: "Asia/Kolkata",
            deletedAt: null,
            deletionScheduledAt: null,
        });
        expect([...user.authProviders]).toEqual(["local"]);
        expect(user.createdAt).toBeInstanceOf(Date);
        expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it.each([
        ["role", "root"],
        ["status", "banned"],
        ["locale", "fr"],
        ["tokenVersion", -1],
        ["tokenVersion", 1.5],
        ["name", ""],
        ["email", "not-an-email"],
    ])("rejects an invalid %s (%s)", async (field, value) => {
        await expect(
            User.create(makeUser({ [field]: value }))
        ).rejects.toThrow();
    });

    it("rejects a name over 100 characters and an unknown provider", async () => {
        await expect(
            User.create(makeUser({ name: "x".repeat(101) }))
        ).rejects.toThrow();
        await expect(
            User.create(makeUser({ authProviders: ["facebook"] }))
        ).rejects.toThrow();
    });

    it("keeps arrays bounded: 3 password hashes, 20 known devices, 3 providers", async () => {
        await expect(
            User.create(makeUser({ passwordHistory: ["a", "b", "c", "d"] }))
        ).rejects.toThrow(/PASSWORD_HISTORY_TOO_LONG/);
        await expect(
            User.create(
                makeUser({
                    knownDeviceHashes: Array.from({ length: 21 }, () =>
                        "a".repeat(64)
                    ),
                })
            )
        ).rejects.toThrow(/KNOWN_DEVICES_TOO_LONG/);
        await expect(
            User.create(
                makeUser({ authProviders: ["local", "google", "sso", "local"] })
            )
        ).rejects.toThrow(/AUTH_PROVIDERS_TOO_LONG/);
        await expect(
            User.create(makeUser({ knownDeviceHashes: ["short"] }))
        ).rejects.toThrow();
    });

    it("requires a publicId when an avatar is present", async () => {
        await expect(
            User.create(
                makeUser({ avatar: { url: "https://example.test/a.png" } })
            )
        ).rejects.toThrow(/AVATAR_PUBLIC_ID_REQUIRED/);
        const user = await User.create(
            makeUser({
                avatar: { publicId: "samarth-ai/test/avatars/a", version: 3 },
            })
        );
        expect(user.avatar.publicId).toBe("samarth-ai/test/avatars/a");
    });

    it("makes orgId immutable", async () => {
        const user = await User.create(makeUser());
        user.orgId = "000000000000000000000002";
        await user.save();
        expect(String((await User.findById(user._id).lean()).orgId)).toBe(
            String(makeUser().orgId)
        );
    });

    it("reports isLocked from lockUntil", async () => {
        const future = new Date(Date.now() + 60_000);
        expect(new User(makeUser({ lockUntil: future })).isLocked).toBe(true);
        expect(
            new User(makeUser({ lockUntil: new Date(Date.now() - 1000) }))
                .isLocked
        ).toBe(false);
        expect(new User(makeUser()).isLocked).toBe(false);
    });
});

describe("User model secrets (DB-11, DB-13)", () => {
    it("hides passwordHash, passwordHistory and knownDeviceHashes unless selected", async () => {
        const created = await User.create(
            makeUser({
                passwordHash: "hash",
                passwordHistory: ["old"],
                knownDeviceHashes: ["a".repeat(64)],
            })
        );
        const plain = await User.findById(created._id);
        expect(plain.passwordHash).toBeUndefined();
        expect(plain.passwordHistory).toBeUndefined();
        expect(plain.knownDeviceHashes).toBeUndefined();
        const selected = await User.findById(created._id).select(
            "+passwordHash +passwordHistory +knownDeviceHashes"
        );
        expect(selected.passwordHash).toBe("hash");
        expect(selected.passwordHistory).toEqual(["old"]);
        expect(selected.knownDeviceHashes).toHaveLength(1);
    });

    it("toJSON maps _id to id and removes __v and every secret even when selected", async () => {
        const created = await User.create(makeUser({ passwordHash: "hash" }));
        const loaded = await User.findById(created._id).select(
            "+passwordHash +passwordHistory +knownDeviceHashes"
        );
        const json = loaded.toJSON();
        expect(json.id).toBe(String(created._id));
        for (const key of [
            "_id",
            "__v",
            "passwordHash",
            "passwordHistory",
            "knownDeviceHashes",
        ]) {
            expect(json).not.toHaveProperty(key);
        }
    });
});

describe("User model soft delete (DB-27, DB-28)", () => {
    it("hides deleted users from queries unless withDeleted is set", async () => {
        const live = await User.create(makeUser());
        const gone = await User.create(makeUser({ deletedAt: new Date() }));
        expect(await User.findById(gone._id)).toBeNull();
        expect(await User.findOne({ email: gone.email })).toBeNull();
        expect((await User.findById(live._id))._id).toEqual(live._id);
        const withDeleted = await User.findById(gone._id).setOptions({
            withDeleted: true,
        });
        expect(withDeleted).toBeTruthy();
    });
});
