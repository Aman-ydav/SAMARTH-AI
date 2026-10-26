import mongoose from "mongoose";
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
import { createUser } from "#tests/factories/user.factory.js";
import { makeAuthCtx } from "#tests/helpers/authCtx.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { logout, logoutAll, revokeSession } from "./logout.service.js";
import { RefreshSession } from "./refreshSession.model.js";
import { createSession, findLiveFamily } from "./session.service.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

const ctx = makeAuthCtx();

describe("logout", () => {
    it("revokes the session of the refresh cookie and is idempotent", async () => {
        const user = await createUser();
        const { familyId, refreshToken } = await createSession({ user, ctx });
        expect(await logout({ refreshToken }, ctx)).toBe(familyId);
        expect(await findLiveFamily(familyId, user._id)).toBeNull();
        expect(await logout({ refreshToken }, ctx)).toBe(familyId);
    });

    it.each([undefined, "", "unknown-token", 42])(
        "with %j revokes nothing and does not fail",
        async (refreshToken) => {
            const user = await createUser();
            await createSession({ user, ctx });
            expect(await logout({ refreshToken }, ctx)).toBeNull();
            expect(
                await RefreshSession.countDocuments({ revokedAt: null })
            ).toBe(1);
        }
    );
});

describe("logoutAll", () => {
    it("revokes every session of the user only, and audits LOGOUT_ALL", async () => {
        const user = await createUser();
        const stranger = await createUser();
        await createSession({ user, ctx });
        await createSession({ user, ctx });
        const strangerSession = await createSession({ user: stranger, ctx });
        expect(await logoutAll({ userId: user._id, orgId: user.orgId })).toBe(
            2
        );
        expect(
            await findLiveFamily(strangerSession.familyId, stranger._id)
        ).toBeTruthy();
        expect(
            await RefreshSession.countDocuments({
                userId: user._id,
                revokedAt: null,
            })
        ).toBe(0);
        const [event] = await AuditLog.find({ action: "LOGOUT_ALL" })
            .limit(2)
            .lean();
        expect(event.meta).toEqual({ revoked: 2 });
    });
});

describe("revokeSession", () => {
    it("revokes an own session, audits it and reports whether it was the current one", async () => {
        const user = await createUser();
        const current = await createSession({ user, ctx });
        const other = await createSession({ user, ctx });
        const base = {
            userId: user._id,
            orgId: user.orgId,
            currentSid: current.familyId,
        };
        expect(
            await revokeSession({ ...base, familyId: other.familyId })
        ).toEqual({ wasCurrent: false });
        expect(
            await revokeSession({ ...base, familyId: current.familyId })
        ).toEqual({ wasCurrent: true });
        expect(
            await AuditLog.countDocuments({ action: "SESSION_REVOKED" })
        ).toBe(2);
    });

    it("answers 400 INVALID_ID for a malformed id and 404 for a foreign or unknown one", async () => {
        const user = await createUser();
        const stranger = await createUser();
        const theirs = await createSession({ user: stranger, ctx });
        const base = { userId: user._id, orgId: user.orgId, currentSid: null };
        await expect(
            revokeSession({ ...base, familyId: "not-an-id" })
        ).rejects.toMatchObject({
            statusCode: 400,
            code: "INVALID_ID",
        });
        await expect(
            revokeSession({ ...base, familyId: theirs.familyId })
        ).rejects.toMatchObject({
            statusCode: 404,
        });
        await expect(
            revokeSession({
                ...base,
                familyId: new mongoose.Types.ObjectId().toHexString(),
            })
        ).rejects.toMatchObject({ statusCode: 404 });
        expect(
            await findLiveFamily(theirs.familyId, stranger._id)
        ).toBeTruthy();
    });
});
