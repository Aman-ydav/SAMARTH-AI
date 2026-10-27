import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { AuditLog } from "#modules/audit/auditLog.model.js";
import { Invite } from "#modules/users/invite.model.js";
import { User } from "#modules/users/user.model.js";
import { createUser } from "#tests/factories/user.factory.js";
import { makeAuthCtx } from "#tests/helpers/authCtx.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { tokenOf } from "#integrations/email/memory.adapter.js";
import { acceptInvite, createInvite } from "./invite.service.js";
import { RefreshSession } from "./refreshSession.model.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);
afterEach(() => vi.useRealTimers());

const PASSWORD = "Sturdy-Meadow-Lantern-Quartz-55";
const asActor = (user) => ({
    userId: String(user._id),
    role: user.role,
    orgId: String(user.orgId),
});

async function invited({
    role = "trainer",
    actorRole = "admin",
    ctx = makeAuthCtx(),
} = {}) {
    const admin = await createUser({ role: actorRole, name: "Admin Person" });
    const invite = await createInvite(
        { email: "New.Invitee@Example.TEST", role },
        asActor(admin),
        ctx
    );
    await ctx.emailService.whenSettled();
    const mail = ctx.outbox.latest({
        to: "new.invitee@example.test",
        templateKey: "invite",
    });
    return { ctx, admin, invite, mail, token: tokenOf(mail) };
}

describe("createInvite (doc 20 section 8)", () => {
    it("stores the invite, mails a 7 day link and audits INVITE_SENT", async () => {
        const { admin, invite, mail, token } = await invited();
        expect(invite).toMatchObject({
            email: "new.invitee@example.test",
            role: "trainer",
            status: "sent",
        });
        expect(String(invite.invitedBy)).toBe(String(admin._id));
        expect(mail.data).toMatchObject({
            inviterName: "Admin Person",
            role: "trainer",
            expiresIn: "7 days",
        });
        expect(mail.data.link).toMatch(/\/accept-invite#token=/);
        expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(invite.expiresAt.getTime() - Date.now()).toBeGreaterThan(
            6.9 * 86_400_000
        );
        expect(await AuditLog.countDocuments({ action: "INVITE_SENT" })).toBe(
            1
        );
    });

    it("learners and trainers can never invite, whatever role they ask for (R68)", async () => {
        for (const actorRole of ["learner", "trainer"]) {
            const actor = await createUser({ role: actorRole });
            for (const role of ["learner", "trainer", "admin"]) {
                await expect(
                    createInvite(
                        { email: "x@example.test", role },
                        asActor(actor),
                        makeAuthCtx()
                    )
                ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
            }
        }
        expect(await Invite.countDocuments({})).toBe(0);
    });

    it("an admin may invite trainers only; a platform admin may invite trainers and admins (R68, AUTH-61)", async () => {
        const admin = await createUser({ role: "admin" });
        const platform = await createUser({ role: "superadmin" });
        for (const role of ["admin", "learner", "superadmin", "root"]) {
            await expect(
                createInvite(
                    { email: "x@example.test", role },
                    asActor(admin),
                    makeAuthCtx()
                )
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
        }
        await expect(
            createInvite(
                { email: "t1@example.test", role: "trainer" },
                asActor(admin),
                makeAuthCtx()
            )
        ).resolves.toMatchObject({ role: "trainer" });
        for (const role of ["trainer", "admin"]) {
            await expect(
                createInvite(
                    { email: `p-${role}@example.test`, role },
                    asActor(platform),
                    makeAuthCtx()
                )
            ).resolves.toMatchObject({ role });
        }
        for (const role of ["superadmin", "learner"]) {
            await expect(
                createInvite(
                    { email: "nope@example.test", role },
                    asActor(platform),
                    makeAuthCtx()
                )
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
        }
        expect(await User.countDocuments({ role: "superadmin" })).toBe(1);
    });

    it("refuses a second open invite and an address that already has an account", async () => {
        const { admin, ctx } = await invited();
        await expect(
            createInvite(
                { email: "new.invitee@example.test", role: "trainer" },
                asActor(admin),
                ctx
            )
        ).rejects.toMatchObject({
            statusCode: 409,
            code: "CONFLICT",
        });
        const existing = await createUser();
        const clash = await createInvite(
            { email: existing.email, role: "trainer" },
            asActor(admin),
            ctx
        ).catch((error) => error);
        expect(clash).toMatchObject({ statusCode: 409, code: "CONFLICT" });
        // The answer is the same generic text for an open invite and for a registered address: it names neither.
        expect(clash.message).not.toContain(existing.email);
        expect(JSON.stringify(clash.errors)).not.toContain(existing.email);
    });

    it("a lapsed invite (still `sent` after 7 days) no longer blocks a new invite; it is closed as expired", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
        const { admin, invite, ctx } = await invited();
        vi.setSystemTime(new Date("2026-11-03T10:00:00Z"));
        const again = await createInvite(
            { email: "new.invitee@example.test", role: "trainer" },
            asActor(admin),
            ctx
        );
        expect(String(again._id)).not.toBe(String(invite._id));
        expect((await Invite.findById(invite._id).lean()).status).toBe(
            "expired"
        );
        expect((await Invite.findById(again._id).lean()).status).toBe("sent");
    });

    it("applies the domain policy", async () => {
        const ctx = makeAuthCtx({ env: { ALLOWED_EMAIL_DOMAINS: "gov.in" } });
        const admin = await createUser({ role: "admin" });
        await expect(
            createInvite(
                { email: "x@gmail.example", role: "trainer" },
                asActor(admin),
                ctx
            )
        ).rejects.toMatchObject({
            code: "DOMAIN_NOT_ALLOWED",
        });
    });
});

describe("acceptInvite (doc 08 #22)", () => {
    it("creates an active, verified user with the INVITED role and starts a session", async () => {
        const { ctx, invite, token } = await invited({ role: "trainer" });
        const result = await acceptInvite(
            { token, name: "Invited Person", password: PASSWORD },
            ctx
        );
        expect(result.user).toMatchObject({
            email: "new.invitee@example.test",
            role: "trainer",
            status: "active",
            emailVerified: true,
            name: "Invited Person",
        });
        expect(result.session.refreshToken).toBeTruthy();
        const saved = await User.findOne({
            email: "new.invitee@example.test",
        }).lean();
        expect(String(saved.orgId)).toBe(String(invite.orgId));
        expect(await Invite.findById(invite._id).lean()).toMatchObject({
            status: "accepted",
        });
        expect(
            (await Invite.findById(invite._id).lean()).acceptedAt
        ).toBeInstanceOf(Date);
        expect(
            await AuditLog.countDocuments({ action: "INVITE_ACCEPTED" })
        ).toBe(1);
        expect(await RefreshSession.countDocuments({ userId: saved._id })).toBe(
            1
        );
    });

    it("ignores any role the caller tries to add (the schema is strict; the service only uses the invite)", async () => {
        const { ctx, token } = await invited({ role: "trainer" });
        const result = await acceptInvite(
            {
                token,
                name: "Invited Person",
                password: PASSWORD,
                role: "superadmin",
            },
            ctx
        );
        expect(result.user.role).toBe("trainer");
    });

    it("is single use", async () => {
        const { ctx, token } = await invited();
        await acceptInvite(
            { token, name: "Invited Person", password: PASSWORD },
            ctx
        );
        await expect(
            acceptInvite({ token, name: "Again", password: PASSWORD }, ctx)
        ).rejects.toMatchObject({
            statusCode: 400,
            code: "INVITE_INVALID",
        });
        expect(
            await User.countDocuments({ email: "new.invitee@example.test" })
        ).toBe(1);
    });

    it.each([
        ["unknown", "i".repeat(43)],
        ["malformed", "x y"],
    ])("rejects a %s token", async (_label, token) => {
        await expect(
            acceptInvite(
                { token, name: "N", password: PASSWORD },
                makeAuthCtx()
            )
        ).rejects.toMatchObject({ code: "INVITE_INVALID" });
    });

    it("rejects a revoked invite and an expired one (7 days, fake clock)", async () => {
        const revoked = await invited();
        await Invite.updateOne(
            { _id: revoked.invite._id },
            { status: "revoked" }
        );
        await expect(
            acceptInvite(
                { token: revoked.token, name: "N", password: PASSWORD },
                revoked.ctx
            )
        ).rejects.toMatchObject({
            code: "INVITE_INVALID",
        });

        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
        await resetAuthDb();
        const fresh = await invited();
        vi.setSystemTime(new Date("2026-11-02T10:00:01Z"));
        await expect(
            acceptInvite(
                { token: fresh.token, name: "N", password: PASSWORD },
                fresh.ctx
            )
        ).rejects.toMatchObject({
            code: "INVITE_INVALID",
        });
    });

    it("rejects when the address registered an account in the meantime, without burning the user's data", async () => {
        const { ctx, token } = await invited();
        const existing = await createUser({
            email: "new.invitee@example.test",
            name: "Already Here",
        });
        await expect(
            acceptInvite({ token, name: "Intruder", password: PASSWORD }, ctx)
        ).rejects.toMatchObject({ code: "INVITE_INVALID" });
        expect((await User.findById(existing._id).lean()).name).toBe(
            "Already Here"
        );
    });

    it("enforces the password policy before consuming the token, and the domain policy", async () => {
        const { ctx, token } = await invited();
        await expect(
            acceptInvite({ token, name: "N", password: "short" }, ctx)
        ).rejects.toMatchObject({ code: "PASSWORD_POLICY" });
        await expect(
            acceptInvite(
                { token, name: "N", password: "new.invitee-is-my-name" },
                ctx
            )
        ).rejects.toMatchObject({ code: "PASSWORD_POLICY" });
        await expect(
            acceptInvite({ token, name: "N", password: PASSWORD }, ctx)
        ).resolves.toBeTruthy();

        await resetAuthDb();
        const restricted = makeAuthCtx({
            env: { ALLOWED_EMAIL_DOMAINS: "gov.in" },
        });
        const open = await invited();
        await expect(
            acceptInvite(
                { token: open.token, name: "N", password: PASSWORD },
                restricted
            )
        ).rejects.toMatchObject({
            code: "DOMAIN_NOT_ALLOWED",
        });
    });

    it("two concurrent acceptances create exactly one user", async () => {
        const { ctx, token } = await invited();
        const results = await Promise.allSettled([
            acceptInvite({ token, name: "A", password: PASSWORD }, ctx),
            acceptInvite({ token, name: "B", password: PASSWORD }, ctx),
        ]);
        expect(
            results.filter((result) => result.status === "fulfilled")
        ).toHaveLength(1);
        expect(
            await User.countDocuments({ email: "new.invitee@example.test" })
        ).toBe(1);
    });
});
