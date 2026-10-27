import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { AuthToken } from "./authToken.model.js";
import { User } from "#modules/users/user.model.js";
import { createUser } from "#tests/factories/user.factory.js";
import { makeAuthCtx } from "#tests/helpers/authCtx.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { issuePasswordSetup } from "./passwordSetup.service.js";
import { resetPassword } from "./passwordReset.service.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

const tokenFrom = (message) =>
    new URL(message.data.link).hash.slice("#token=".length);

describe("issuePasswordSetup (R68)", () => {
    it("returns the set-password mail for the reset flow and sends nothing itself", async () => {
        const ctx = makeAuthCtx();
        const user = await createUser({
            passwordHash: null,
            role: "superadmin",
            name: "Platform admin",
        });
        const message = await issuePasswordSetup(user, { config: ctx.config });
        expect(message).toMatchObject({
            to: user.email,
            templateKey: "password-reset",
            data: {
                name: "Platform admin",
                variant: "setup",
                expiresIn: "30 minutes",
            },
        });
        expect(message.data.link).toMatch(
            /\/reset-password#token=[A-Za-z0-9_-]{43}$/
        );
        expect(new Date(message.data.requestedAt).getTime()).not.toBeNaN();
        expect(ctx.outbox.find({})).toHaveLength(0);
        const stored = await AuthToken.findOne({ userId: user._id })
            .select("+tokenHash")
            .lean();
        expect(stored).toMatchObject({
            type: "passwordReset",
            email: user.email,
        });
        expect(stored.tokenHash).not.toContain(tokenFrom(message));
    });

    it("lets the person choose a password through the normal reset flow, which clears the need to change it", async () => {
        const ctx = makeAuthCtx();
        const user = await createUser({
            passwordHash: null,
            role: "superadmin",
        });
        const message = await issuePasswordSetup(user, { config: ctx.config });
        await resetPassword(
            {
                token: tokenFrom(message),
                newPassword: "Chosen-Passphrase-Value-12",
            },
            ctx
        );
        const after = await User.findById(user._id)
            .select("+passwordHash")
            .lean();
        expect(after.passwordHash).toMatch(/^\$2b\$/);
        expect(after.role).toBe("superadmin");
        expect(after.mustChangePassword).toBe(false);
        await expect(
            resetPassword(
                {
                    token: tokenFrom(message),
                    newPassword: "Chosen-Passphrase-Value-13",
                },
                ctx
            )
        ).rejects.toMatchObject({ code: "RESET_TOKEN_INVALID" });
    });

    it("a newer setup link supersedes the older one", async () => {
        const ctx = makeAuthCtx();
        const user = await createUser({
            passwordHash: null,
            role: "superadmin",
        });
        const first = await issuePasswordSetup(user, { config: ctx.config });
        const second = await issuePasswordSetup(user, { config: ctx.config });
        await expect(
            resetPassword(
                {
                    token: tokenFrom(first),
                    newPassword: "Chosen-Passphrase-Value-12",
                },
                ctx
            )
        ).rejects.toMatchObject({ code: "RESET_TOKEN_INVALID" });
        await expect(
            resetPassword(
                {
                    token: tokenFrom(second),
                    newPassword: "Chosen-Passphrase-Value-12",
                },
                ctx
            )
        ).resolves.toBeUndefined();
    });
});
