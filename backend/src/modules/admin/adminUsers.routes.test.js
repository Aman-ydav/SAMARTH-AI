// supertest route tests for GET /admin/users, PATCH /admin/users/:id/status and PATCH /admin/users/:id/role.
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
import { User } from "#modules/users/user.model.js";
import { createUser, newObjectId } from "#tests/factories/user.factory.js";
import { buildAuthApp, loginAs } from "#tests/helpers/authApp.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { expectError, expectSuccess } from "#tests/helpers/envelopes.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

const USERS = "/api/v1/admin/users";

async function world() {
    const built = buildAuthApp();
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
    return {
        ...built,
        platform,
        admin,
        trainer,
        learner,
        asPlatform: await loginAs(built.app, platform.email),
        asAdmin: await loginAs(built.app, admin.email),
    };
}

describe("GET /admin/users", () => {
    it("lists users for an admin without secrets and without platform admins", async () => {
        const { asAdmin } = await world();
        const body = expectSuccess(await asAdmin.agent.get(USERS));
        expect(body.data.users.map((u) => u.email).sort()).toEqual([
            "admin@example.test",
            "learner@example.test",
            "trainer@example.test",
        ]);
        expect(body.meta).toMatchObject({ total: 3, page: 1, limit: 20 });
        expect(JSON.stringify(body)).not.toMatch(
            /passwordHash|tokenVersion|plat@example/
        );
        expect(Object.keys(body.data.users[0]).sort()).toEqual([
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
    });

    it("shows a platform admin everyone, and supports role, status, prefix search and paging", async () => {
        const { asPlatform, learner } = await world();
        await User.updateOne({ _id: learner._id }, { status: "suspended" });
        const everyone = expectSuccess(await asPlatform.agent.get(USERS));
        expect(everyone.meta.total).toBe(4);
        const query = async (qs) =>
            expectSuccess(await asPlatform.agent.get(`${USERS}?${qs}`));
        expect((await query("role=superadmin")).data.users).toHaveLength(1);
        expect((await query("status=suspended")).data.users[0].email).toBe(
            "learner@example.test"
        );
        expect((await query("q=TRAIN")).data.users[0].email).toBe(
            "trainer@example.test"
        );
        expect((await query("q=.*")).data.users).toEqual([]);
        expect(
            (await query("limit=2&page=2&sort=email&order=asc")).data.users.map(
                (u) => u.email
            )
        ).toEqual(["plat@example.test", "trainer@example.test"]);
        expect((await query("page=99")).data.users).toEqual([]);
    });

    it("an admin asking for platform admins gets an empty page, not a hint", async () => {
        const { asAdmin } = await world();
        const body = expectSuccess(
            await asAdmin.agent.get(`${USERS}?role=superadmin`)
        );
        expect(body.data.users).toEqual([]);
        expect(body.meta.total).toBe(0);
    });

    it("rejects unknown keys, bad enums, over-long search and bad sort", async () => {
        const { asPlatform } = await world();
        for (const qs of [
            "orgId=1",
            "role=owner",
            "status=gone",
            `q=${"a".repeat(65)}`,
            "sort=passwordHash",
            "order=up",
        ]) {
            expectError(
                await asPlatform.agent.get(`${USERS}?${qs}`),
                400,
                "VALIDATION_ERROR"
            );
        }
    });

    it("NoSQL operators in the query string are inert", async () => {
        const { asPlatform } = await world();
        const response = await asPlatform.agent.get(
            `${USERS}?role[$ne]=learner&q[$gt]=a`
        );
        expectError(response, 400, "VALIDATION_ERROR");
    });
});

describe("PATCH /admin/users/:id/status", () => {
    it("an admin suspends a learner: the old session dies, sign-in says suspended, reactivation restores it", async () => {
        const { app, asAdmin, learner } = await world();
        const asLearner = await loginAs(app, learner.email);
        expectSuccess(await asLearner.agent.get("/api/v1/profile"));

        const body = expectSuccess(
            await asAdmin.agent
                .patch(`${USERS}/${learner._id}/status`)
                .send({ status: "suspended" })
        );
        expect(body.data.user).toMatchObject({
            id: String(learner._id),
            status: "suspended",
        });
        expectError(
            await asLearner.agent.get("/api/v1/profile"),
            403,
            "ACCOUNT_SUSPENDED"
        );
        expect(
            await RefreshSession.countDocuments({
                userId: learner._id,
                revokedAt: null,
            })
        ).toBe(0);
        const again = await loginAs(app, learner.email);
        expectError(again.response, 403, "ACCOUNT_SUSPENDED");

        expectSuccess(
            await asAdmin.agent
                .patch(`${USERS}/${learner._id}/status`)
                .send({ status: "active" })
        );
        const back = await loginAs(app, learner.email);
        expect(back.response.status).toBe(200);
        expect(
            await AuditLog.countDocuments({ action: "USER_SUSPENDED" })
        ).toBe(1);
        expect(
            await AuditLog.countDocuments({ action: "USER_REACTIVATED" })
        ).toBe(1);
    });

    it("applies the actor matrix: admin to learner and trainer only, platform admin also to admin, nobody to self or to a platform admin", async () => {
        const { asPlatform, asAdmin, platform, admin, trainer } = await world();
        const patch = (who, id, status = "suspended") =>
            who.agent.patch(`${USERS}/${id}/status`).send({ status });
        expectSuccess(await patch(asAdmin, trainer._id));
        expectError(
            await patch(asAdmin, admin._id),
            403,
            "SELF_ACTION_FORBIDDEN"
        );
        expectError(await patch(asAdmin, platform._id), 404, "NOT_FOUND");
        expectError(
            await patch(asPlatform, platform._id),
            403,
            "SELF_ACTION_FORBIDDEN"
        );
        const other = await createUser({ role: "admin" });
        expectError(await patch(asAdmin, other._id), 403, "FORBIDDEN");
        expectSuccess(await patch(asPlatform, other._id));
        const peer = await createUser({ role: "superadmin" });
        expectError(await patch(asPlatform, peer._id), 403, "FORBIDDEN");
        expect((await User.findById(platform._id).lean()).status).toBe(
            "active"
        );
        expect((await User.findById(peer._id).lean()).status).toBe("active");
    });

    it("validates the body and the id; unknown, foreign and conflicting targets", async () => {
        const { asAdmin, learner } = await world();
        const url = `${USERS}/${learner._id}/status`;
        for (const body of [
            {},
            { status: "deleted" },
            { status: "pending_deletion" },
            { status: "suspended", role: "admin" },
            { status: 1 },
        ]) {
            expectError(
                await asAdmin.agent.patch(url).send(body),
                400,
                "VALIDATION_ERROR"
            );
        }
        expectError(
            await asAdmin.agent
                .patch(`${USERS}/nope/status`)
                .send({ status: "suspended" }),
            400,
            "INVALID_ID"
        );
        expectError(
            await asAdmin.agent
                .patch(`${USERS}/${newObjectId()}/status`)
                .send({ status: "suspended" }),
            404,
            "NOT_FOUND"
        );
        const foreign = await createUser({ orgId: newObjectId() });
        expectError(
            await asAdmin.agent
                .patch(`${USERS}/${foreign._id}/status`)
                .send({ status: "suspended" }),
            404,
            "NOT_FOUND"
        );
        expectError(
            await asAdmin.agent.patch(url).send({ status: "active" }),
            409,
            "CONFLICT"
        );
    });
});

describe("PATCH /admin/users/:id/role", () => {
    it("a platform admin changes a role: the person is signed out, the new role applies at the next sign-in", async () => {
        const { app, asPlatform, learner } = await world();
        const asLearner = await loginAs(app, learner.email);
        expectError(
            await asLearner.agent.get("/api/v1/admin/users"),
            403,
            "FORBIDDEN"
        );

        const body = expectSuccess(
            await asPlatform.agent
                .patch(`${USERS}/${learner._id}/role`)
                .send({ role: "admin" })
        );
        expect(body.data.user).toMatchObject({
            id: String(learner._id),
            role: "admin",
        });
        const stale = await asLearner.agent.get("/api/v1/admin/users");
        expect(stale.status).toBe(401);
        expect(["TOKEN_INVALID", "SESSION_REVOKED"]).toContain(stale.body.code);
        expect(
            await RefreshSession.countDocuments({
                userId: learner._id,
                revokedAt: null,
            })
        ).toBe(0);

        const fresh = await loginAs(app, learner.email);
        expect(fresh.response.body.data.user.role).toBe("admin");
        expectSuccess(await fresh.agent.get("/api/v1/admin/users"));
        const demoted = expectSuccess(
            await asPlatform.agent
                .patch(`${USERS}/${learner._id}/role`)
                .send({ role: "trainer" })
        );
        expect(demoted.data.user.role).toBe("trainer");
        expect((await fresh.agent.get("/api/v1/admin/users")).status).toBe(401);
    });

    it("only a platform admin may change roles; nobody can reach or grant the platform admin role", async () => {
        const { asPlatform, asAdmin, platform, admin, learner } = await world();
        const patch = (who, id, role) =>
            who.agent.patch(`${USERS}/${id}/role`).send({ role });
        expectError(
            await patch(asAdmin, learner._id, "trainer"),
            403,
            "FORBIDDEN"
        );
        expectError(
            await patch(asAdmin, admin._id, "superadmin"),
            403,
            "FORBIDDEN"
        );
        expectError(
            await patch(asPlatform, learner._id, "superadmin"),
            400,
            "VALIDATION_ERROR"
        );
        expectError(
            await patch(asPlatform, platform._id, "admin"),
            403,
            "SELF_ACTION_FORBIDDEN"
        );
        const peer = await createUser({ role: "superadmin" });
        expectError(
            await patch(asPlatform, peer._id, "learner"),
            403,
            "FORBIDDEN"
        );
        expectError(
            await patch(asPlatform, learner._id, "learner"),
            409,
            "CONFLICT"
        );
        expectError(await patch(asPlatform, "bad", "admin"), 400, "INVALID_ID");
        expectError(
            await patch(asPlatform, newObjectId(), "admin"),
            404,
            "NOT_FOUND"
        );
        expect((await User.findById(peer._id).lean()).role).toBe("superadmin");
        expect((await User.findById(learner._id).lean()).role).toBe("learner");
    });

    it("the only platform admin cannot be demoted or suspended through the API", async () => {
        const { asPlatform, asAdmin, platform } = await world();
        expectError(
            await asPlatform.agent
                .patch(`${USERS}/${platform._id}/role`)
                .send({ role: "learner" }),
            403,
            "SELF_ACTION_FORBIDDEN"
        );
        expectError(
            await asPlatform.agent
                .patch(`${USERS}/${platform._id}/status`)
                .send({ status: "suspended" }),
            403,
            "SELF_ACTION_FORBIDDEN"
        );
        expectError(
            await asAdmin.agent
                .patch(`${USERS}/${platform._id}/status`)
                .send({ status: "suspended" }),
            404,
            "NOT_FOUND"
        );
        expect(await User.findById(platform._id).lean()).toMatchObject({
            role: "superadmin",
            status: "active",
        });
    });

    it("rejects extra fields in the body", async () => {
        const { asPlatform, learner } = await world();
        const url = `${USERS}/${learner._id}/role`;
        for (const body of [
            {},
            { role: "admin", orgId: "x" },
            { role: "ADMIN" },
            { role: ["admin"] },
        ]) {
            expectError(
                await asPlatform.agent.patch(url).send(body),
                400,
                "VALIDATION_ERROR"
            );
        }
    });
});
