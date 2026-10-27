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
import { tokenOf } from "#integrations/email/memory.adapter.js";
import { AuditLog } from "#modules/audit/auditLog.model.js";
import { Invite } from "#modules/users/invite.model.js";
import { User } from "#modules/users/user.model.js";
import { createUser, newObjectId } from "#tests/factories/user.factory.js";
import { makeAuthCtx } from "#tests/helpers/authCtx.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { acceptInvite, createInvite } from "./invite.service.js";
import {
    listInvites,
    MAX_INVITE_RESENDS,
    resendInvite,
    revokeInvite,
    toInviteView,
} from "./inviteAdmin.service.js";

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

async function setup() {
    const platform = await createUser({
        role: "superadmin",
        name: "Plat Form",
    });
    const admin = await createUser({ role: "admin", name: "Org Admin" });
    return { platform, admin, ctx: makeAuthCtx() };
}

async function inviteAs(actor, ctx, email, role = "trainer") {
    const invite = await createInvite({ email, role }, asActor(actor), ctx);
    await ctx.emailService.whenSettled();
    const mail = ctx.outbox.latest({ to: email, templateKey: "invite" });
    return { invite, token: tokenOf(mail) };
}

describe("toInviteView", () => {
    it("is an allow-list without the token id, and shows a lapsed open invite as expired", async () => {
        const { admin, ctx } = await setup();
        const { invite } = await inviteAs(admin, ctx, "a@example.test");
        const view = toInviteView(invite);
        expect(Object.keys(view).sort()).toEqual([
            "acceptedAt",
            "createdAt",
            "departmentId",
            "email",
            "expiresAt",
            "id",
            "invitedBy",
            "resentCount",
            "role",
            "status",
        ]);
        expect(view.status).toBe("sent");
        expect(
            toInviteView(invite, new Date(Date.now() + 8 * 86_400_000)).status
        ).toBe("expired");
        expect(JSON.stringify(view)).not.toContain("tokenId");
    });
});

describe("listInvites", () => {
    it("forbids learners and trainers", async () => {
        for (const role of ["learner", "trainer"]) {
            const actor = await createUser({ role });
            await expect(listInvites(asActor(actor))).rejects.toMatchObject({
                statusCode: 403,
                code: "FORBIDDEN",
            });
        }
    });

    it("shows a platform admin every role and an admin only the roles an admin may invite", async () => {
        const { platform, admin, ctx } = await setup();
        await inviteAs(platform, ctx, "t@example.test", "trainer");
        await inviteAs(platform, ctx, "a@example.test", "admin");
        const all = await listInvites(asActor(platform));
        expect(all.items.map((item) => item.role).sort()).toEqual([
            "admin",
            "trainer",
        ]);
        expect(all.meta).toMatchObject({
            page: 1,
            limit: 20,
            total: 2,
            hasNext: false,
        });
        const own = await listInvites(asActor(admin));
        expect(own.items.map((item) => item.role)).toEqual(["trainer"]);
        expect(own.meta.total).toBe(1);
    });

    it("is scoped to the actor's org", async () => {
        const { platform, ctx } = await setup();
        await inviteAs(platform, ctx, "t@example.test");
        const other = await createUser({
            role: "superadmin",
            orgId: newObjectId(),
        });
        const result = await listInvites(asActor(other));
        expect(result.items).toEqual([]);
        expect(result.meta.total).toBe(0);
    });

    it("paginates with a stable order and clamps bad page numbers", async () => {
        const { platform, ctx } = await setup();
        for (const name of ["a", "b", "c"])
            await inviteAs(platform, ctx, `${name}@example.test`);
        const first = await listInvites(asActor(platform), {
            limit: "2",
            sort: "email",
            order: "asc",
        });
        expect(first.items.map((item) => item.email)).toEqual([
            "a@example.test",
            "b@example.test",
        ]);
        expect(first.meta).toMatchObject({
            total: 3,
            totalPages: 2,
            hasNext: true,
        });
        const second = await listInvites(asActor(platform), {
            limit: "2",
            page: "2",
            sort: "email",
            order: "asc",
        });
        expect(second.items.map((item) => item.email)).toEqual([
            "c@example.test",
        ]);
        const beyond = await listInvites(asActor(platform), { page: "9" });
        expect(beyond.items).toEqual([]);
        const clamped = await listInvites(asActor(platform), {
            page: "-4",
            limit: "100000",
        });
        expect(clamped.meta).toMatchObject({ page: 1, limit: 100 });
    });

    it("rejects an unknown sort field", async () => {
        const { platform } = await setup();
        await expect(
            listInvites(asActor(platform), { sort: "tokenId" })
        ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
    });

    it("filters by status: sent, expired (lapsed included), accepted, revoked", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
        const { platform, ctx } = await setup();
        await inviteAs(platform, ctx, "lapsed@example.test");
        const accepted = await inviteAs(platform, ctx, "accepted@example.test");
        const revoked = await inviteAs(platform, ctx, "revoked@example.test");
        await acceptInvite(
            {
                token: accepted.token,
                name: "Accepted Person",
                password: PASSWORD,
            },
            ctx
        );
        await revokeInvite(asActor(platform), revoked.invite._id);
        vi.setSystemTime(new Date("2026-11-04T10:00:00Z"));
        await inviteAs(platform, ctx, "fresh@example.test");

        const emails = async (status) =>
            (await listInvites(asActor(platform), { status })).items
                .map((item) => item.email)
                .sort();
        expect(await emails("sent")).toEqual(["fresh@example.test"]);
        expect(await emails("expired")).toEqual(["lapsed@example.test"]);
        expect(await emails("accepted")).toEqual(["accepted@example.test"]);
        expect(await emails("revoked")).toEqual(["revoked@example.test"]);
        expect(await emails(undefined)).toHaveLength(4);
    });
});

describe("revokeInvite", () => {
    it("revokes an open invite, kills its link, audits it and frees the address", async () => {
        const { platform, ctx } = await setup();
        const { invite, token } = await inviteAs(
            platform,
            ctx,
            "t@example.test"
        );
        const view = await revokeInvite(asActor(platform), invite._id);
        expect(view).toMatchObject({
            status: "revoked",
            email: "t@example.test",
        });
        expect((await Invite.findById(invite._id).lean()).status).toBe(
            "revoked"
        );
        await expect(
            acceptInvite(
                { token, name: "Late Person", password: PASSWORD },
                ctx
            )
        ).rejects.toMatchObject({ code: "INVITE_INVALID" });
        expect(await User.exists({ email: "t@example.test" })).toBeNull();
        expect(
            await AuditLog.countDocuments({ action: "INVITE_REVOKED" })
        ).toBe(1);
        await expect(
            createInvite(
                { email: "t@example.test", role: "trainer" },
                asActor(platform),
                ctx
            )
        ).resolves.toBeTruthy();
    });

    it("answers 409 for an invite that is already revoked or accepted", async () => {
        const { platform, ctx } = await setup();
        const first = await inviteAs(platform, ctx, "r@example.test");
        await revokeInvite(asActor(platform), first.invite._id);
        await expect(
            revokeInvite(asActor(platform), first.invite._id)
        ).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });
        const second = await inviteAs(platform, ctx, "x@example.test");
        await acceptInvite(
            {
                token: second.token,
                name: "Accepted Person",
                password: PASSWORD,
            },
            ctx
        );
        await expect(
            revokeInvite(asActor(platform), second.invite._id)
        ).rejects.toMatchObject({ statusCode: 409 });
        expect(await User.exists({ email: "x@example.test" })).toBeTruthy();
    });

    it("answers 404 for a missing, foreign-org or out-of-grant invite and 400 for a bad id", async () => {
        const { platform, admin, ctx } = await setup();
        const adminInvite = await inviteAs(
            platform,
            ctx,
            "boss@example.test",
            "admin"
        );
        await expect(
            revokeInvite(asActor(admin), adminInvite.invite._id)
        ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
        const foreign = await createUser({
            role: "superadmin",
            orgId: newObjectId(),
        });
        await expect(
            revokeInvite(asActor(foreign), adminInvite.invite._id)
        ).rejects.toMatchObject({ statusCode: 404 });
        await expect(
            revokeInvite(asActor(platform), String(newObjectId()))
        ).rejects.toMatchObject({ statusCode: 404 });
        await expect(
            revokeInvite(asActor(platform), "not-an-id")
        ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_ID" });
        expect(
            (await Invite.findById(adminInvite.invite._id).lean()).status
        ).toBe("sent");
    });

    it("forbids learners and trainers", async () => {
        const { platform, ctx } = await setup();
        const { invite } = await inviteAs(platform, ctx, "t@example.test");
        const trainer = await createUser({ role: "trainer" });
        await expect(
            revokeInvite(asActor(trainer), invite._id)
        ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("a revoke racing an accept leaves exactly one winner", async () => {
        const { platform, ctx } = await setup();
        const { invite, token } = await inviteAs(
            platform,
            ctx,
            "race@example.test"
        );
        const results = await Promise.allSettled([
            revokeInvite(asActor(platform), invite._id),
            acceptInvite(
                { token, name: "Racing Person", password: PASSWORD },
                ctx
            ),
        ]);
        const won = results.filter((result) => result.status === "fulfilled");
        expect(won).toHaveLength(1);
        const stored = await Invite.findById(invite._id).lean();
        const userExists = Boolean(
            await User.exists({ email: "race@example.test" })
        );
        expect(userExists).toBe(stored.status === "accepted");
        expect(["accepted", "revoked"]).toContain(stored.status);
    });
});

describe("resendInvite", () => {
    it("supersedes the old token, mails a new link, extends the expiry and counts the resend", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
        const { platform, ctx } = await setup();
        const { invite, token: oldToken } = await inviteAs(
            platform,
            ctx,
            "t@example.test"
        );
        vi.setSystemTime(new Date("2026-10-30T10:00:00Z"));
        const view = await resendInvite(asActor(platform), invite._id, ctx);
        await ctx.emailService.whenSettled();

        expect(view).toMatchObject({ status: "sent", resentCount: 1 });
        expect(new Date(view.expiresAt).toISOString()).toBe(
            "2026-11-06T10:00:00.000Z"
        );
        const mails = ctx.outbox.find({
            to: "t@example.test",
            templateKey: "invite",
        });
        expect(mails).toHaveLength(2);
        const newToken = tokenOf(mails.at(-1));
        expect(newToken).not.toBe(oldToken);
        expect(mails.at(-1).data.link).toMatch(/\/accept-invite#token=/);
        expect(await AuditLog.countDocuments({ action: "INVITE_RESENT" })).toBe(
            1
        );

        await expect(
            acceptInvite(
                { token: oldToken, name: "Old Link", password: PASSWORD },
                ctx
            )
        ).rejects.toMatchObject({ code: "INVITE_INVALID" });
        const result = await acceptInvite(
            { token: newToken, name: "New Link", password: PASSWORD },
            ctx
        );
        expect(result.user.role).toBe("trainer");
    });

    it("revives a lapsed invite", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
        const { platform, ctx } = await setup();
        const { invite } = await inviteAs(platform, ctx, "t@example.test");
        vi.setSystemTime(new Date("2026-11-05T10:00:00Z"));
        expect((await listInvites(asActor(platform))).items[0].status).toBe(
            "expired"
        );
        const view = await resendInvite(asActor(platform), invite._id, ctx);
        expect(view.status).toBe("sent");
    });

    it("stops after the resend cap with 422", async () => {
        const { platform, ctx } = await setup();
        const { invite } = await inviteAs(platform, ctx, "t@example.test");
        for (let count = 0; count < MAX_INVITE_RESENDS; count += 1)
            await resendInvite(asActor(platform), invite._id, ctx);
        await expect(
            resendInvite(asActor(platform), invite._id, ctx)
        ).rejects.toMatchObject({ statusCode: 422, code: "UNPROCESSABLE" });
        expect((await Invite.findById(invite._id).lean()).resentCount).toBe(
            MAX_INVITE_RESENDS
        );
    });

    it("refuses revoked and accepted invites (409), foreign ones (404) and wrong roles (403)", async () => {
        const { platform, admin, ctx } = await setup();
        const revoked = await inviteAs(platform, ctx, "r@example.test");
        await revokeInvite(asActor(platform), revoked.invite._id);
        await expect(
            resendInvite(asActor(platform), revoked.invite._id, ctx)
        ).rejects.toMatchObject({ statusCode: 409 });
        const accepted = await inviteAs(platform, ctx, "a@example.test");
        await acceptInvite(
            {
                token: accepted.token,
                name: "Accepted Person",
                password: PASSWORD,
            },
            ctx
        );
        await expect(
            resendInvite(asActor(platform), accepted.invite._id, ctx)
        ).rejects.toMatchObject({ statusCode: 409 });
        const adminInvite = await inviteAs(
            platform,
            ctx,
            "boss@example.test",
            "admin"
        );
        await expect(
            resendInvite(asActor(admin), adminInvite.invite._id, ctx)
        ).rejects.toMatchObject({ statusCode: 404 });
        const learner = await createUser({ role: "learner" });
        await expect(
            resendInvite(asActor(learner), adminInvite.invite._id, ctx)
        ).rejects.toMatchObject({ statusCode: 403 });
        await expect(
            resendInvite(asActor(platform), "nope", ctx)
        ).rejects.toMatchObject({ code: "INVALID_ID" });
    });

    it("applies the domain policy again", async () => {
        const { platform, ctx } = await setup();
        const { invite } = await inviteAs(platform, ctx, "t@example.test");
        const restricted = makeAuthCtx({
            env: { ALLOWED_EMAIL_DOMAINS: "gov.in" },
        });
        await expect(
            resendInvite(asActor(platform), invite._id, restricted)
        ).rejects.toMatchObject({ code: "DOMAIN_NOT_ALLOWED" });
        expect((await Invite.findById(invite._id).lean()).resentCount).toBe(0);
    });
});
