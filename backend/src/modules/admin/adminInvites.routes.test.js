// supertest route tests for POST/GET /admin/invites, DELETE /admin/invites/:id, POST /admin/invites/:id/resend.
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { tokenOf } from "#integrations/email/memory.adapter.js";
import { AuditLog } from "#modules/audit/auditLog.model.js";
import { Invite } from "#modules/users/invite.model.js";
import { User } from "#modules/users/user.model.js";
import { createUser, newObjectId } from "#tests/factories/user.factory.js";
import { createAuthAgent } from "#tests/helpers/authAgent.js";
import { buildAuthApp, loginAs } from "#tests/helpers/authApp.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { expectError, expectSuccess } from "#tests/helpers/envelopes.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

const INVITES = "/api/v1/admin/invites";
const PASSWORD = "Sturdy-Meadow-Lantern-Quartz-55";

async function world(env) {
    const built = buildAuthApp({ env });
    const platform = await createUser({
        role: "superadmin",
        name: "Plat Form",
    });
    const admin = await createUser({ role: "admin", name: "Org Admin" });
    const asPlatform = await loginAs(built.app, platform.email);
    const asAdmin = await loginAs(built.app, admin.email);
    return { ...built, platform, admin, asPlatform, asAdmin };
}

const mailFor = async (emailService, email) => {
    await emailService.whenSettled();
    return emailService.outbox.find({ to: email, templateKey: "invite" });
};

describe("POST /admin/invites", () => {
    it("a platform admin invites a trainer and an admin: 201, the invite view, one mail each, audited", async () => {
        const { asPlatform, emailService } = await world();
        for (const role of ["trainer", "admin"]) {
            const email = `${role}@example.test`;
            const body = expectSuccess(
                await asPlatform.agent
                    .post(INVITES)
                    .send({ email: email.toUpperCase(), role }),
                201
            );
            expect(body.data.invite).toMatchObject({
                email,
                role,
                status: "sent",
                resentCount: 0,
            });
            expect(JSON.stringify(body)).not.toMatch(/tokenId|tokenHash/);
            const mails = await mailFor(emailService, email);
            expect(mails).toHaveLength(1);
            expect(mails[0].data).toMatchObject({
                inviterName: "Plat Form",
                role,
            });
        }
        expect(await AuditLog.countDocuments({ action: "INVITE_SENT" })).toBe(
            2
        );
    });

    it("an admin invites a trainer, but never an admin, a learner or a platform admin", async () => {
        const { asAdmin, emailService } = await world();
        expectSuccess(
            await asAdmin.agent
                .post(INVITES)
                .send({ email: "t@example.test", role: "trainer" }),
            201
        );
        expectError(
            await asAdmin.agent
                .post(INVITES)
                .send({ email: "a@example.test", role: "admin" }),
            403,
            "FORBIDDEN"
        );
        for (const role of ["learner", "superadmin", "root"]) {
            expectError(
                await asAdmin.agent
                    .post(INVITES)
                    .send({ email: "x@example.test", role }),
                400,
                "VALIDATION_ERROR"
            );
        }
        expect(await Invite.countDocuments({})).toBe(1);
        expect(await mailFor(emailService, "a@example.test")).toHaveLength(0);
    });

    it("refuses unknown and privileged fields, bad emails and bad department ids", async () => {
        const { asPlatform } = await world();
        const ok = { email: "t@example.test", role: "trainer" };
        for (const extra of [
            { orgId: String(newObjectId()) },
            { invitedBy: String(newObjectId()) },
            { status: "accepted" },
            { tokenId: String(newObjectId()) },
        ]) {
            const body = expectError(
                await asPlatform.agent.post(INVITES).send({ ...ok, ...extra }),
                400,
                "VALIDATION_ERROR"
            );
            expect(body.errors[0].message).toBe("Unknown field");
        }
        expectError(
            await asPlatform.agent.post(INVITES).send({ ...ok, email: "nope" }),
            400,
            "VALIDATION_ERROR"
        );
        expectError(
            await asPlatform.agent
                .post(INVITES)
                .send({ ...ok, departmentId: "zzz" }),
            400,
            "VALIDATION_ERROR"
        );
        expectError(
            await asPlatform.agent.post(INVITES).send({ role: "trainer" }),
            400,
            "VALIDATION_ERROR"
        );
        expect(await Invite.countDocuments({})).toBe(0);
    });

    it("an existing account or an open invite is a plain 409 that names neither", async () => {
        const { asPlatform, platform } = await world();
        await asPlatform.agent
            .post(INVITES)
            .send({ email: "t@example.test", role: "trainer" });
        const duplicate = expectError(
            await asPlatform.agent
                .post(INVITES)
                .send({ email: "T@Example.test", role: "trainer" }),
            409,
            "CONFLICT"
        );
        const registered = expectError(
            await asPlatform.agent
                .post(INVITES)
                .send({ email: platform.email, role: "admin" }),
            409,
            "CONFLICT"
        );
        expect(registered.message).toBe(duplicate.message);
        expect(JSON.stringify(registered)).not.toContain(platform.email);
    });

    it("applies the email domain policy", async () => {
        const { asPlatform } = await world({
            ALLOWED_EMAIL_DOMAINS: "example.test",
        });
        expectError(
            await asPlatform.agent
                .post(INVITES)
                .send({ email: "t@other.example", role: "trainer" }),
            403,
            "DOMAIN_NOT_ALLOWED"
        );
    });

    it("the invited person accepts once, gets the invited role, and a second accept fails", async () => {
        const { app, asPlatform, emailService } = await world();
        await asPlatform.agent
            .post(INVITES)
            .send({ email: "boss@example.test", role: "admin" });
        const token = tokenOf(
            (await mailFor(emailService, "boss@example.test"))[0]
        );
        const visitor = await createAuthAgent(app);
        const accepted = expectSuccess(
            await visitor
                .post("/api/v1/auth/accept-invite")
                .send({ token, name: "New Boss", password: PASSWORD })
        );
        expect(accepted.data.user).toMatchObject({
            role: "admin",
            status: "active",
            emailVerified: true,
        });
        const again = await createAuthAgent(app);
        expectError(
            await again
                .post("/api/v1/auth/accept-invite")
                .send({ token, name: "Again", password: PASSWORD }),
            400,
            "INVITE_INVALID"
        );
        expect(
            (await Invite.findOne({ email: "boss@example.test" }).lean()).status
        ).toBe("accepted");
    });

    it("two people accepting the same link at once create exactly one account", async () => {
        const { app, asPlatform, emailService } = await world();
        await asPlatform.agent
            .post(INVITES)
            .send({ email: "race@example.test", role: "trainer" });
        const token = tokenOf(
            (await mailFor(emailService, "race@example.test"))[0]
        );
        const [one, two] = await Promise.all([
            createAuthAgent(app),
            createAuthAgent(app),
        ]);
        const responses = await Promise.all(
            [one, two].map((agent) =>
                agent
                    .post("/api/v1/auth/accept-invite")
                    .send({ token, name: "Racer", password: PASSWORD })
            )
        );
        expect(responses.map((r) => r.status).sort()).toEqual([200, 400]);
        expect(await User.countDocuments({ email: "race@example.test" })).toBe(
            1
        );
    });
});

describe("GET /admin/invites", () => {
    it("lists newest first with page meta, hides admin invites from an admin, filters by status", async () => {
        const { asPlatform, asAdmin } = await world();
        await asPlatform.agent
            .post(INVITES)
            .send({ email: "t1@example.test", role: "trainer" });
        await asPlatform.agent
            .post(INVITES)
            .send({ email: "t2@example.test", role: "trainer" });
        await asPlatform.agent
            .post(INVITES)
            .send({ email: "a1@example.test", role: "admin" });

        const all = expectSuccess(await asPlatform.agent.get(INVITES));
        expect(all.data.invites).toHaveLength(3);
        expect(all.data.invites[0].email).toBe("a1@example.test");
        expect(all.meta).toEqual({
            page: 1,
            limit: 20,
            total: 3,
            totalPages: 1,
            hasNext: false,
        });

        const own = expectSuccess(await asAdmin.agent.get(INVITES));
        expect(own.data.invites.map((i) => i.role)).toEqual([
            "trainer",
            "trainer",
        ]);

        const paged = expectSuccess(
            await asPlatform.agent.get(`${INVITES}?limit=2&page=2`)
        );
        expect(paged.data.invites).toHaveLength(1);
        expect(paged.meta).toMatchObject({
            page: 2,
            totalPages: 2,
            hasNext: false,
        });

        expect(
            expectSuccess(
                await asPlatform.agent.get(`${INVITES}?status=accepted`)
            ).data.invites
        ).toEqual([]);
        expect(
            expectSuccess(await asPlatform.agent.get(`${INVITES}?status=sent`))
                .meta.total
        ).toBe(3);
    });

    it("rejects bad filters, unknown keys and unsupported sort fields", async () => {
        const { asPlatform } = await world();
        for (const query of [
            "status=weird",
            "role=admin",
            "sort=tokenId",
            "order=sideways",
        ]) {
            expectError(
                await asPlatform.agent.get(`${INVITES}?${query}`),
                400,
                "VALIDATION_ERROR"
            );
        }
    });

    it("never shows another org's invites", async () => {
        const { asPlatform } = await world();
        await Invite.create({
            orgId: newObjectId(),
            email: "foreign@example.test",
            role: "trainer",
            invitedBy: newObjectId(),
            tokenId: newObjectId(),
            expiresAt: new Date(Date.now() + 86_400_000),
        });
        expect(
            expectSuccess(await asPlatform.agent.get(INVITES)).data.invites
        ).toEqual([]);
    });
});

describe("DELETE /admin/invites/:id", () => {
    it("revokes: 200, and the emailed link stops working", async () => {
        const { app, asPlatform, emailService } = await world();
        const created = await asPlatform.agent
            .post(INVITES)
            .send({ email: "t@example.test", role: "trainer" });
        const token = tokenOf(
            (await mailFor(emailService, "t@example.test"))[0]
        );
        const revoked = expectSuccess(
            await asPlatform.agent.delete(
                `${INVITES}/${created.body.data.invite.id}`
            )
        );
        expect(revoked.data.invite.status).toBe("revoked");
        const visitor = await createAuthAgent(app);
        expectError(
            await visitor
                .post("/api/v1/auth/accept-invite")
                .send({ token, name: "Late", password: PASSWORD }),
            400,
            "INVITE_INVALID"
        );
        expect(await User.exists({ email: "t@example.test" })).toBeNull();
        expectError(
            await asPlatform.agent.delete(
                `${INVITES}/${created.body.data.invite.id}`
            ),
            409,
            "CONFLICT"
        );
    });

    it("404 for unknown, foreign-org or out-of-grant invites; 400 for a malformed id", async () => {
        const { asPlatform, asAdmin } = await world();
        const adminInvite = await asPlatform.agent
            .post(INVITES)
            .send({ email: "a@example.test", role: "admin" });
        expectError(
            await asAdmin.agent.delete(
                `${INVITES}/${adminInvite.body.data.invite.id}`
            ),
            404,
            "NOT_FOUND"
        );
        expectError(
            await asPlatform.agent.delete(`${INVITES}/${newObjectId()}`),
            404,
            "NOT_FOUND"
        );
        expectError(
            await asPlatform.agent.delete(`${INVITES}/not-an-id`),
            400,
            "INVALID_ID"
        );
        expect(
            (await Invite.findOne({ email: "a@example.test" }).lean()).status
        ).toBe("sent");
    });
});

describe("POST /admin/invites/:id/resend", () => {
    it("sends a new link, kills the old one and counts the resend", async () => {
        const { app, asPlatform, emailService } = await world();
        const created = await asPlatform.agent
            .post(INVITES)
            .send({ email: "t@example.test", role: "trainer" });
        const oldToken = tokenOf(
            (await mailFor(emailService, "t@example.test"))[0]
        );
        const resent = expectSuccess(
            await asPlatform.agent.post(
                `${INVITES}/${created.body.data.invite.id}/resend`
            )
        );
        expect(resent.data.invite).toMatchObject({
            status: "sent",
            resentCount: 1,
        });
        const mails = await mailFor(emailService, "t@example.test");
        expect(mails).toHaveLength(2);
        const visitor = await createAuthAgent(app);
        expectError(
            await visitor
                .post("/api/v1/auth/accept-invite")
                .send({ token: oldToken, name: "Old", password: PASSWORD }),
            400,
            "INVITE_INVALID"
        );
        const second = await createAuthAgent(app);
        expectSuccess(
            await second.post("/api/v1/auth/accept-invite").send({
                token: tokenOf(mails.at(-1)),
                name: "Fresh Link",
                password: PASSWORD,
            })
        );
    });

    it("409 once revoked, 404 for unknown ids, 422 after five resends", async () => {
        const { asPlatform } = await world();
        const created = await asPlatform.agent
            .post(INVITES)
            .send({ email: "t@example.test", role: "trainer" });
        const url = `${INVITES}/${created.body.data.invite.id}/resend`;
        for (let count = 0; count < 5; count += 1)
            expectSuccess(await asPlatform.agent.post(url));
        expectError(await asPlatform.agent.post(url), 422, "UNPROCESSABLE");
        await asPlatform.agent.delete(
            `${INVITES}/${created.body.data.invite.id}`
        );
        expectError(await asPlatform.agent.post(url), 409, "CONFLICT");
        expectError(
            await asPlatform.agent.post(`${INVITES}/${newObjectId()}/resend`),
            404,
            "NOT_FOUND"
        );
        expectError(
            await asPlatform.agent.post(`${INVITES}/bad-id/resend`),
            400,
            "INVALID_ID"
        );
    });
});
