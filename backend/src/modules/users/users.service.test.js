import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { makeUser } from "#tests/factories/user.factory.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { User } from "./user.model.js";
import {
    assertNotLastAdmin,
    findUserByEmail,
    getAuthUser,
    getCurrentUser,
    getProfile,
    needsOnboarding,
    toAuthUser,
    updateProfile,
} from "./users.service.js";

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

const create = (overrides = {}) =>
    User.create(makeUser({ passwordHash: "stored-hash", ...overrides }));

describe("toAuthUser (doc 08 section 3, BE-47)", () => {
    it("exposes exactly the documented summary fields", async () => {
        const user = await create({
            avatar: {
                publicId: "p/1",
                version: 4,
                url: "https://example.test/a.png",
                bytes: 10,
            },
        });
        const loaded = await User.findById(user._id).select("+passwordHash");
        expect(Object.keys(toAuthUser(loaded)).sort()).toEqual(
            [
                "authProviders",
                "avatar",
                "email",
                "emailVerified",
                "hasPassword",
                "id",
                "locale",
                "mustChangePassword",
                "name",
                "orgId",
                "role",
                "status",
            ].sort()
        );
        expect(toAuthUser(loaded)).toMatchObject({
            id: String(user._id),
            hasPassword: true,
            avatar: { publicId: "p/1", version: 4 },
            orgId: String(user.orgId),
        });
    });

    it("never leaks hashes, history, device hashes or the token version", async () => {
        const user = await create({
            passwordHistory: ["old"],
            knownDeviceHashes: ["a".repeat(64)],
            tokenVersion: 7,
        });
        const loaded = await User.findById(user._id).select(
            "+passwordHash +passwordHistory +knownDeviceHashes"
        );
        const dump = JSON.stringify(toAuthUser(loaded));
        for (const secret of [
            "stored-hash",
            "old",
            "a".repeat(64),
            "tokenVersion",
            "passwordHash",
        ]) {
            expect(dump).not.toContain(secret);
        }
    });

    it("reports hasPassword false without a hash, accepts lean documents and an explicit override", async () => {
        const user = await create({ passwordHash: undefined });
        const lean = await User.findById(user._id).lean();
        expect(toAuthUser(lean).hasPassword).toBe(false);
        expect(toAuthUser(lean, { hasPassword: true }).hasPassword).toBe(true);
        expect(toAuthUser(lean).avatar).toBeNull();
    });
});

describe("getCurrentUser, getProfile, findUserByEmail", () => {
    it("returns the summary with needsOnboarding", async () => {
        const user = await create();
        await expect(getCurrentUser(user._id)).resolves.toMatchObject({
            user: { id: String(user._id), hasPassword: true },
            needsOnboarding: false,
        });
        const unconsented = await create({ termsAcceptedAt: undefined });
        expect((await getCurrentUser(unconsented._id)).needsOnboarding).toBe(
            true
        );
        expect(needsOnboarding({ termsAcceptedAt: new Date() })).toBe(false);
    });

    it("getAuthUser returns just the summary (used by other modules)", async () => {
        const user = await create();
        expect(await getAuthUser(user._id)).toEqual((await getCurrentUser(user._id)).user);
        await expect(getAuthUser(new mongoose.Types.ObjectId())).rejects.toMatchObject({ statusCode: 404 });
    });

    it("includes the timezone in the profile", async () => {
        const user = await create();
        expect(await getProfile(user._id)).toMatchObject({
            id: String(user._id),
            timezone: "Asia/Kolkata",
        });
    });

    it("answers 404 for an unknown or soft-deleted user", async () => {
        const gone = await create({ deletedAt: new Date() });
        for (const id of [new mongoose.Types.ObjectId(), gone._id]) {
            await expect(getCurrentUser(id)).rejects.toMatchObject({
                statusCode: 404,
            });
            await expect(getProfile(id)).rejects.toMatchObject({
                statusCode: 404,
            });
            await expect(
                updateProfile(id, { name: "X" })
            ).rejects.toMatchObject({ statusCode: 404 });
        }
    });

    it("finds a user by any spelling of the email", async () => {
        const user = await create({ email: "find.me@example.test" });
        expect(
            String((await findUserByEmail("  FIND.me@Example.test "))._id)
        ).toBe(String(user._id));
        expect(await findUserByEmail("nobody@example.test")).toBeNull();
        expect(
            (await findUserByEmail(user.email, { select: "+passwordHash" }))
                .passwordHash
        ).toBe("stored-hash");
    });
});

describe("updateProfile (AUTH-59, DB-15)", () => {
    it("updates only the whitelisted fields", async () => {
        const user = await create();
        const updated = await updateProfile(user._id, {
            name: "New Name",
            locale: "hi",
            timezone: "Europe/Paris",
        });
        expect(updated).toMatchObject({
            name: "New Name",
            locale: "hi",
            timezone: "Europe/Paris",
        });
        expect(await User.findById(user._id).lean()).toMatchObject({
            name: "New Name",
            locale: "hi",
            timezone: "Europe/Paris",
        });
    });

    it("supports partial updates and leaves the other fields alone", async () => {
        const user = await create({ name: "Keep Me" });
        await updateProfile(user._id, { locale: "hi" });
        expect(await User.findById(user._id).lean()).toMatchObject({
            name: "Keep Me",
            locale: "hi",
        });
    });

    it("can never change role, status, email, orgId or tokenVersion, even if they are passed", async () => {
        const user = await create();
        await updateProfile(user._id, {
            name: "Ok",
            role: "superadmin",
            status: "suspended",
            email: "hijack@example.test",
            orgId: new mongoose.Types.ObjectId(),
            tokenVersion: 99,
        });
        expect(await User.findById(user._id).lean()).toMatchObject({
            role: "learner",
            status: "active",
            email: user.email,
            tokenVersion: 0,
            orgId: user.orgId,
        });
    });

    it("runs the model validators on update", async () => {
        const user = await create();
        await expect(
            updateProfile(user._id, { locale: "fr" })
        ).rejects.toThrow();
        await expect(
            updateProfile(user._id, { name: "x".repeat(101) })
        ).rejects.toThrow();
    });
});

describe("assertNotLastAdmin (AUTH-61)", () => {
    it("ignores learners and trainers", async () => {
        for (const role of ["learner", "trainer"]) {
            await expect(
                assertNotLastAdmin(await create({ role }))
            ).resolves.toBeUndefined();
        }
    });

    it("refuses the only active admin-level user with LAST_ADMIN", async () => {
        const only = await create({ role: "admin" });
        await expect(assertNotLastAdmin(only)).rejects.toMatchObject({
            statusCode: 409,
            code: "LAST_ADMIN",
        });
        const solo = await create({
            role: "superadmin",
            orgId: new mongoose.Types.ObjectId(),
        });
        await expect(assertNotLastAdmin(solo)).rejects.toMatchObject({
            code: "LAST_ADMIN",
        });
    });

    it("passes when another ACTIVE admin or superadmin exists in the org", async () => {
        const first = await create({ role: "admin" });
        await create({ role: "superadmin" });
        await expect(assertNotLastAdmin(first)).resolves.toBeUndefined();
    });

    it("does not count suspended or other-org admins", async () => {
        const first = await create({ role: "admin" });
        await create({ role: "admin", status: "suspended" });
        await create({ role: "admin", orgId: new mongoose.Types.ObjectId() });
        await expect(assertNotLastAdmin(first)).rejects.toMatchObject({
            code: "LAST_ADMIN",
        });
    });
});
