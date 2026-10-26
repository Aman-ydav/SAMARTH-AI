import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
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
import { User } from "#modules/users/user.model.js";
import { TEST_PASSWORD, createUser } from "#tests/factories/user.factory.js";
import { makeAuthCtx } from "#tests/helpers/authCtx.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { changePassword, deleteAccount } from "./account.service.js";
import { RefreshSession } from "./refreshSession.model.js";
import { createSession, findLiveFamily } from "./session.service.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);
afterEach(() => vi.useRealTimers());

const NEW_PASSWORD = "Fresh-Unrelated-Passphrase-9";
const ctx = makeAuthCtx();

describe("changePassword (AUTH-25, AUTH-55)", () => {
    async function twoSessions() {
        const user = await createUser();
        const current = await createSession({ user, ctx });
        const other = await createSession({ user, ctx });
        return { user, current, other };
    }

    it("changes the password, bumps tokenVersion, revokes the OTHER sessions and keeps the current one", async () => {
        const { user, current, other } = await twoSessions();
        const before = await User.findById(user._id)
            .select("+passwordHash")
            .lean();
        const result = await changePassword(
            {
                userId: user._id,
                sid: current.familyId,
                currentPassword: TEST_PASSWORD,
                newPassword: NEW_PASSWORD,
            },
            ctx
        );
        const saved = await User.findById(user._id)
            .select("+passwordHash +passwordHistory")
            .lean();
        expect(await bcrypt.compare(NEW_PASSWORD, saved.passwordHash)).toBe(
            true
        );
        expect(saved.passwordHistory).toEqual([before.passwordHash]);
        expect(saved.tokenVersion).toBe(1);
        expect(await findLiveFamily(current.familyId, user._id)).toBeTruthy();
        expect(await findLiveFamily(other.familyId, user._id)).toBeNull();
        expect(
            (await RefreshSession.findOne({ familyId: other.familyId }).lean())
                .revokedReason
        ).toBe("password_change");

        // the current session gets a new access token with the NEW tv, a new csrf value and keeps its refresh token
        expect(jwt.decode(result.session.accessToken)).toMatchObject({
            tv: 1,
            sid: current.familyId,
        });
        expect(result.session.refreshToken).toBeUndefined();
        expect(result.session.csrfToken).toBeTruthy();
        expect(result.user.hasPassword).toBe(true);

        await ctx.emailService.whenSettled();
        expect(
            ctx.outbox.find({ to: user.email, templateKey: "password-changed" })
        ).toHaveLength(1);
        expect(
            await AuditLog.countDocuments({ action: "PASSWORD_CHANGED" })
        ).toBe(1);
    });

    it("answers INVALID_CREDENTIALS for a wrong current password and changes nothing", async () => {
        const { user, current } = await twoSessions();
        await expect(
            changePassword(
                {
                    userId: user._id,
                    sid: current.familyId,
                    currentPassword: "Wrong-Password-Value-1",
                    newPassword: NEW_PASSWORD,
                },
                ctx
            )
        ).rejects.toMatchObject({
            statusCode: 401,
            code: "INVALID_CREDENTIALS",
        });
        expect((await User.findById(user._id).lean()).tokenVersion).toBe(0);
        expect(await RefreshSession.countDocuments({ revokedAt: null })).toBe(
            2
        );
    });

    it("enforces policy and refuses the current password or a recent one", async () => {
        const { user, current } = await twoSessions();
        const attempt = (newPassword) =>
            changePassword(
                {
                    userId: user._id,
                    sid: current.familyId,
                    currentPassword: TEST_PASSWORD,
                    newPassword,
                },
                ctx
            );
        await expect(attempt("short")).rejects.toMatchObject({
            code: "PASSWORD_POLICY",
        });
        await expect(attempt(TEST_PASSWORD)).rejects.toMatchObject({
            code: "PASSWORD_REUSED",
        });
        await attempt(NEW_PASSWORD);
        await expect(
            changePassword(
                {
                    userId: user._id,
                    sid: current.familyId,
                    currentPassword: NEW_PASSWORD,
                    newPassword: TEST_PASSWORD,
                },
                ctx
            )
        ).rejects.toMatchObject({ code: "PASSWORD_REUSED" });
    });

    it("lets a Google-only account set a password with a fresh credential, and REAUTH_REQUIRED without one", async () => {
        const user = await createUser({
            passwordHash: null,
            googleSub: "g-1",
            authProviders: ["google"],
        });
        const session = await createSession({ user, ctx });
        const google = makeAuthCtx();
        google.verifyGoogleCredential.mockResolvedValue({
            sub: "g-1",
            email: user.email,
            name: "X",
        });
        await expect(
            changePassword(
                {
                    userId: user._id,
                    sid: session.familyId,
                    newPassword: NEW_PASSWORD,
                },
                google
            )
        ).rejects.toMatchObject({ statusCode: 403, code: "REAUTH_REQUIRED" });
        await expect(
            changePassword(
                {
                    userId: user._id,
                    sid: session.familyId,
                    currentPassword: TEST_PASSWORD,
                    newPassword: NEW_PASSWORD,
                },
                google
            )
        ).rejects.toMatchObject({ code: "REAUTH_REQUIRED" });
        const result = await changePassword(
            {
                userId: user._id,
                sid: session.familyId,
                credential: "google-credential-value",
                newPassword: NEW_PASSWORD,
            },
            google
        );
        expect(result.user).toMatchObject({ hasPassword: true });
        expect([...result.user.authProviders].sort()).toEqual([
            "google",
            "local",
        ]);
    });

    it("turns a limited must-change-password session into a normal one (R39)", async () => {
        const user = await createUser({ mustChangePassword: true });
        const result = await changePassword(
            {
                userId: user._id,
                sid: null,
                currentPassword: TEST_PASSWORD,
                newPassword: NEW_PASSWORD,
            },
            ctx
        );
        expect(result.session.refreshToken).toBeTruthy();
        expect(jwt.decode(result.session.accessToken)).toHaveProperty("sid");
        expect(result.user.mustChangePassword).toBe(false);
        expect((await User.findById(user._id).lean()).mustChangePassword).toBe(
            false
        );
        expect(
            await RefreshSession.countDocuments({
                userId: user._id,
                revokedAt: null,
            })
        ).toBe(1);
    });

    it("answers 404 for a user that no longer exists", async () => {
        await expect(
            changePassword(
                {
                    userId: new mongoose.Types.ObjectId(),
                    sid: null,
                    currentPassword: TEST_PASSWORD,
                    newPassword: NEW_PASSWORD,
                },
                ctx
            )
        ).rejects.toMatchObject({ statusCode: 404 });
    });
});

describe("deleteAccount (AUTH-56)", () => {
    it("schedules deletion after the 30 day grace, revokes all sessions, bumps tv and mails", async () => {
        const local = makeAuthCtx();
        const user = await createUser();
        await createSession({ user, ctx: local });
        await createSession({ user, ctx: local });
        const now = new Date("2026-10-26T10:00:00Z");
        const result = await deleteAccount(
            { userId: user._id, currentPassword: TEST_PASSWORD },
            local,
            now
        );

        expect(result.graceEndsAt).toEqual(new Date("2026-11-25T10:00:00Z"));
        expect(await User.findById(user._id).lean()).toMatchObject({
            status: "pending_deletion",
            deletionScheduledAt: new Date("2026-11-25T10:00:00Z"),
            tokenVersion: 1,
        });
        expect(
            await RefreshSession.countDocuments({
                userId: user._id,
                revokedAt: null,
            })
        ).toBe(0);
        await local.emailService.whenSettled();
        const [mail] = local.outbox.find({
            to: user.email,
            templateKey: "deletion-scheduled",
        });
        expect(mail.data.link).toBe("http://localhost:5173/login");
        expect(
            await AuditLog.countDocuments({ action: "DELETION_REQUESTED" })
        ).toBe(1);
    });

    it("re-authenticates first", async () => {
        const user = await createUser();
        await expect(
            deleteAccount(
                { userId: user._id, currentPassword: "Wrong-Password-Value-1" },
                ctx
            )
        ).rejects.toMatchObject({
            code: "INVALID_CREDENTIALS",
        });
        await expect(
            deleteAccount({ userId: user._id }, ctx)
        ).rejects.toMatchObject({ code: "REAUTH_REQUIRED" });
        expect((await User.findById(user._id).lean()).status).toBe("active");
    });

    it("refuses the last active admin with LAST_ADMIN and allows it when another admin exists", async () => {
        const only = await createUser({ role: "admin" });
        await expect(
            deleteAccount(
                { userId: only._id, currentPassword: TEST_PASSWORD },
                ctx
            )
        ).rejects.toMatchObject({
            statusCode: 409,
            code: "LAST_ADMIN",
        });
        expect((await User.findById(only._id).lean()).status).toBe("active");
        await createUser({ role: "superadmin" });
        await expect(
            deleteAccount(
                { userId: only._id, currentPassword: TEST_PASSWORD },
                ctx
            )
        ).resolves.toBeTruthy();
    });

    it("does not count a suspended admin as a second admin", async () => {
        const only = await createUser({ role: "admin" });
        await createUser({ role: "admin", status: "suspended" });
        await expect(
            deleteAccount(
                { userId: only._id, currentPassword: TEST_PASSWORD },
                ctx
            )
        ).rejects.toMatchObject({ code: "LAST_ADMIN" });
    });
});
