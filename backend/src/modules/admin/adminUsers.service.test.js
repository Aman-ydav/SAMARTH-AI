import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { AuditLog } from "#modules/audit/auditLog.model.js";
import { RefreshSession } from "#modules/auth/refreshSession.model.js";
import { createSession } from "#modules/auth/session.service.js";
import { User } from "#modules/users/user.model.js";
import { anyOf, ne } from "#utils/mongoOps.js";
import { createUser, newObjectId } from "#tests/factories/user.factory.js";
import { makeAuthCtx } from "#tests/helpers/authCtx.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import {
    changeUserRole,
    listUsers,
    setUserStatus,
    toAdminUser,
} from "./adminUsers.service.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

const asActor = (user) => ({
    userId: String(user._id),
    role: user.role,
    orgId: String(user.orgId),
});
const reload = (user) => User.findById(user._id).lean();

async function cast() {
    const platform = await createUser({
        role: "superadmin",
        email: "plat@example.test",
    });
    const admin = await createUser({
        role: "admin",
        email: "admin@example.test",
    });
    const trainer = await createUser({
        role: "trainer",
        email: "trainer@example.test",
    });
    const learner = await createUser({
        role: "learner",
        email: "learner@example.test",
    });
    return { platform, admin, trainer, learner };
}

describe("toAdminUser", () => {
    it("is an allow-list that never carries secrets or counters", async () => {
        const user = await createUser();
        const view = toAdminUser(
            await User.findById(user._id).select("+passwordHash")
        );
        expect(Object.keys(view).sort()).toEqual([
            "authProviders",
            "createdAt",
            "email",
            "emailVerified",
            "id",
            "lastLoginAt",
            "mustChangePassword",
            "name",
            "role",
            "status",
        ]);
        expect(JSON.stringify(view)).not.toMatch(
            /passwordHash|tokenVersion|knownDevice/
        );
    });
});

describe("listUsers", () => {
    it("is for admins and platform admins only", async () => {
        const { trainer, learner } = await cast();
        for (const actor of [trainer, learner]) {
            await expect(listUsers(asActor(actor))).rejects.toMatchObject({
                statusCode: 403,
                code: "FORBIDDEN",
            });
        }
    });

    it("hides platform admins from an admin and shows them to a platform admin", async () => {
        const { platform, admin } = await cast();
        const roles = async (actor, query) =>
            (await listUsers(asActor(actor), query)).items
                .map((u) => u.role)
                .sort();
        expect(await roles(admin)).toEqual(["admin", "learner", "trainer"]);
        expect(await roles(platform)).toEqual([
            "admin",
            "learner",
            "superadmin",
            "trainer",
        ]);
        expect(await roles(admin, { role: "superadmin" })).toEqual([]);
        expect(
            (await listUsers(asActor(admin), { role: "superadmin" })).meta.total
        ).toBe(0);
        expect(await roles(platform, { role: "superadmin" })).toEqual([
            "superadmin",
        ]);
    });

    it("filters by role and status, and returns paged meta", async () => {
        const { platform, learner } = await cast();
        await User.updateOne({ _id: learner._id }, { status: "suspended" });
        const suspended = await listUsers(asActor(platform), {
            status: "suspended",
        });
        expect(suspended.items.map((u) => u.email)).toEqual([
            "learner@example.test",
        ]);
        const trainers = await listUsers(asActor(platform), {
            role: "trainer",
        });
        expect(trainers.items).toHaveLength(1);
        const page = await listUsers(asActor(platform), {
            limit: "2",
            sort: "email",
            order: "asc",
        });
        expect(page.items.map((u) => u.email)).toEqual([
            "admin@example.test",
            "learner@example.test",
        ]);
        expect(page.meta).toMatchObject({
            total: 4,
            totalPages: 2,
            hasNext: true,
            limit: 2,
        });
    });

    it("searches an anchored, lower-cased, regex-escaped email prefix", async () => {
        const { platform } = await cast();
        await createUser({ email: "a.b@example.test" });
        await createUser({ email: "axb@example.test" });
        const find = async (q) =>
            (await listUsers(asActor(platform), { q })).items
                .map((u) => u.email)
                .sort();
        expect(await find("LEARN")).toEqual(["learner@example.test"]);
        expect(await find("a.b")).toEqual(["a.b@example.test"]);
        expect(await find("example")).toEqual([]);
        expect(await find(".*")).toEqual([]);
        expect(await find("(")).toEqual([]);
        expect(await find("$ne")).toEqual([]);
    });

    it("never lists another org or a soft-deleted user, and rejects unknown sort fields", async () => {
        const { platform } = await cast();
        await createUser({
            orgId: newObjectId(),
            email: "foreign@example.test",
        });
        await createUser({ email: "gone@example.test", deletedAt: new Date() });
        const emails = (await listUsers(asActor(platform))).items.map(
            (u) => u.email
        );
        expect(emails).not.toContain("foreign@example.test");
        expect(emails).not.toContain("gone@example.test");
        await expect(
            listUsers(asActor(platform), { sort: "passwordHash" })
        ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
        await expect(
            listUsers(asActor(platform), { page: "5000", limit: "100" })
        ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });
});

describe("setUserStatus", () => {
    it("suspends: bumps the token version, revokes every session, audits", async () => {
        const { admin, learner } = await cast();
        await createSession({ user: learner, ctx: makeAuthCtx() });
        await createSession({ user: learner, ctx: makeAuthCtx() });
        const view = await setUserStatus(
            asActor(admin),
            learner._id,
            "suspended"
        );
        expect(view).toMatchObject({ status: "suspended", role: "learner" });
        const after = await reload(learner);
        expect(after.status).toBe("suspended");
        expect(after.tokenVersion).toBe(learner.tokenVersion + 1);
        expect(
            await RefreshSession.countDocuments({
                userId: learner._id,
                revokedAt: null,
            })
        ).toBe(0);
        const entry = await AuditLog.findOne({
            action: "USER_SUSPENDED",
        }).lean();
        expect(String(entry.entityId)).toBe(String(learner._id));
        expect(String(entry.actorId)).toBe(String(admin._id));
        expect(entry.meta).toEqual({ role: "learner" });
    });

    it("reactivates and clears the lock counters", async () => {
        const { admin, trainer } = await cast();
        await User.updateOne(
            { _id: trainer._id },
            {
                status: "suspended",
                failedLoginCount: 4,
                lockoutCount: 2,
                lockUntil: new Date(Date.now() + 60_000),
            }
        );
        const view = await setUserStatus(asActor(admin), trainer._id, "active");
        expect(view.status).toBe("active");
        expect(await reload(trainer)).toMatchObject({
            failedLoginCount: 0,
            lockoutCount: 0,
            lockUntil: null,
        });
        expect(
            await AuditLog.countDocuments({ action: "USER_REACTIVATED" })
        ).toBe(1);
    });

    it("an admin may act on learners and trainers only; a platform admin also on admins", async () => {
        const { platform, admin, trainer } = await cast();
        const otherAdmin = await createUser({ role: "admin" });
        await expect(
            setUserStatus(asActor(admin), otherAdmin._id, "suspended")
        ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
        expect((await reload(otherAdmin)).status).toBe("active");
        await expect(
            setUserStatus(asActor(platform), otherAdmin._id, "suspended")
        ).resolves.toMatchObject({ status: "suspended" });
        await expect(
            setUserStatus(asActor(platform), trainer._id, "suspended")
        ).resolves.toMatchObject({ status: "suspended" });
    });

    it("never acts on oneself", async () => {
        const { platform, admin } = await cast();
        for (const actor of [admin, platform]) {
            await expect(
                setUserStatus(asActor(actor), actor._id, "suspended")
            ).rejects.toMatchObject({
                statusCode: 403,
                code: "SELF_ACTION_FORBIDDEN",
            });
            expect((await reload(actor)).status).toBe("active");
        }
    });

    it("never acts on a platform admin: 404 for an admin, 403 for another platform admin", async () => {
        const { platform, admin } = await cast();
        const second = await createUser({ role: "superadmin" });
        await expect(
            setUserStatus(asActor(admin), platform._id, "suspended")
        ).rejects.toMatchObject({ statusCode: 404 });
        await expect(
            setUserStatus(asActor(second), platform._id, "suspended")
        ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
        expect((await reload(platform)).status).toBe("active");
    });

    it("answers 409 for a transition that is not suspend or reactivate, and 404 / 400 for bad targets", async () => {
        const { admin, learner } = await cast();
        await expect(
            setUserStatus(asActor(admin), learner._id, "active")
        ).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });
        await setUserStatus(asActor(admin), learner._id, "suspended");
        await expect(
            setUserStatus(asActor(admin), learner._id, "suspended")
        ).rejects.toMatchObject({ statusCode: 409 });
        const pending = await createUser({
            status: "pending_verification",
            emailVerified: false,
        });
        await expect(
            setUserStatus(asActor(admin), pending._id, "suspended")
        ).rejects.toMatchObject({ statusCode: 409 });
        const foreign = await createUser({ orgId: newObjectId() });
        await expect(
            setUserStatus(asActor(admin), foreign._id, "suspended")
        ).rejects.toMatchObject({ statusCode: 404 });
        await expect(
            setUserStatus(asActor(admin), String(newObjectId()), "suspended")
        ).rejects.toMatchObject({ statusCode: 404 });
        await expect(
            setUserStatus(asActor(admin), "xyz", "suspended")
        ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_ID" });
    });

    it("forbids learners and trainers", async () => {
        const { trainer, learner } = await cast();
        for (const actor of [trainer, learner]) {
            await expect(
                setUserStatus(asActor(actor), learner._id, "suspended")
            ).rejects.toMatchObject({ statusCode: 403 });
        }
    });

    it("keeps the last-admin guard when the acting account is not itself an active admin", async () => {
        const staleActor = await createUser({
            role: "superadmin",
            status: "suspended",
        });
        const onlyAdmin = await createUser({ role: "admin" });
        await expect(
            setUserStatus(asActor(staleActor), onlyAdmin._id, "suspended")
        ).rejects.toMatchObject({ statusCode: 409, code: "LAST_ADMIN" });
        expect((await reload(onlyAdmin)).status).toBe("active");
    });

    it("two simultaneous suspends leave one winner", async () => {
        const { admin, learner } = await cast();
        const results = await Promise.allSettled([
            setUserStatus(asActor(admin), learner._id, "suspended"),
            setUserStatus(asActor(admin), learner._id, "suspended"),
        ]);
        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        expect((await reload(learner)).tokenVersion).toBe(
            learner.tokenVersion + 1
        );
    });
});

describe("changeUserRole", () => {
    it("moves a person between learner, trainer and admin, ends their sessions and audits from and to", async () => {
        const { platform, learner } = await cast();
        await createSession({ user: learner, ctx: makeAuthCtx() });
        for (const role of ["trainer", "admin", "learner"]) {
            const view = await changeUserRole(
                asActor(platform),
                learner._id,
                role
            );
            expect(view.role).toBe(role);
        }
        const after = await reload(learner);
        expect(after.role).toBe("learner");
        expect(after.tokenVersion).toBe(learner.tokenVersion + 3);
        expect(
            await RefreshSession.countDocuments({
                userId: learner._id,
                revokedAt: null,
            })
        ).toBe(0);
        const entries = await AuditLog.find({ action: "ROLE_CHANGED" })
            .sort({ seq: 1 })
            .lean();
        expect(entries.map((e) => e.meta)).toEqual([
            { from: "learner", to: "trainer" },
            { from: "trainer", to: "admin" },
            { from: "admin", to: "learner" },
        ]);
    });

    it("is for platform admins only", async () => {
        const { admin, trainer, learner } = await cast();
        for (const actor of [admin, trainer, learner]) {
            await expect(
                changeUserRole(asActor(actor), learner._id, "trainer")
            ).rejects.toMatchObject({ statusCode: 403 });
        }
        expect((await reload(learner)).role).toBe("learner");
    });

    it("never touches oneself or a platform admin, and never grants superadmin", async () => {
        const { platform, learner } = await cast();
        const second = await createUser({ role: "superadmin" });
        await expect(
            changeUserRole(asActor(platform), platform._id, "admin")
        ).rejects.toMatchObject({
            statusCode: 403,
            code: "SELF_ACTION_FORBIDDEN",
        });
        await expect(
            changeUserRole(asActor(platform), second._id, "learner")
        ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
        await expect(
            changeUserRole(asActor(platform), learner._id, "superadmin")
        ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
        expect((await reload(second)).role).toBe("superadmin");
        expect((await reload(learner)).role).toBe("learner");
        expect(await AuditLog.countDocuments({})).toBe(0);
    });

    it("answers 409 for the same role, keeps the last-admin guard, and 404 / 400 for bad targets", async () => {
        const { platform, learner } = await cast();
        await expect(
            changeUserRole(asActor(platform), learner._id, "learner")
        ).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });
        const staleActor = await createUser({
            role: "superadmin",
            status: "suspended",
        });
        const onlyAdmin = await createUser({ role: "admin" });
        await User.updateMany(
            { role: anyOf(["admin", "superadmin"]), _id: ne(onlyAdmin._id) },
            { status: "deactivated" }
        );
        await expect(
            changeUserRole(asActor(staleActor), onlyAdmin._id, "learner")
        ).rejects.toMatchObject({ statusCode: 409, code: "LAST_ADMIN" });
        expect((await reload(onlyAdmin)).role).toBe("admin");
        const foreign = await createUser({ orgId: newObjectId() });
        await expect(
            changeUserRole(asActor(platform), foreign._id, "trainer")
        ).rejects.toMatchObject({ statusCode: 404 });
        await expect(
            changeUserRole(asActor(platform), "xyz", "trainer")
        ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_ID" });
    });
});
