import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { User } from "#modules/users/user.model.js";
import { TEST_PASSWORD, createUser } from "#tests/factories/user.factory.js";
import { makeAuthCtx } from "#tests/helpers/authCtx.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { reauthenticate } from "./reauth.service.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

const withHash = (user) => User.findById(user._id).select("+passwordHash");

describe("reauthenticate (AUTH-55)", () => {
    it("accepts the current password", async () => {
        const user = await withHash(await createUser());
        await expect(
            reauthenticate(
                { user, currentPassword: TEST_PASSWORD },
                makeAuthCtx()
            )
        ).resolves.toBeUndefined();
    });

    it("answers INVALID_CREDENTIALS 401 for a wrong current password", async () => {
        const user = await withHash(await createUser());
        await expect(
            reauthenticate(
                { user, currentPassword: "Wrong-Password-Value-1" },
                makeAuthCtx()
            )
        ).rejects.toMatchObject({
            statusCode: 401,
            code: "INVALID_CREDENTIALS",
        });
    });

    it("answers REAUTH_REQUIRED 403 when nothing is sent", async () => {
        const user = await withHash(await createUser());
        await expect(
            reauthenticate({ user }, makeAuthCtx())
        ).rejects.toMatchObject({ statusCode: 403, code: "REAUTH_REQUIRED" });
    });

    it("answers REAUTH_REQUIRED when a Google-only user sends a password", async () => {
        const user = await withHash(
            await createUser({
                passwordHash: null,
                googleSub: "g-1",
                authProviders: ["google"],
            })
        );
        await expect(
            reauthenticate(
                { user, currentPassword: TEST_PASSWORD },
                makeAuthCtx()
            )
        ).rejects.toMatchObject({ statusCode: 403, code: "REAUTH_REQUIRED" });
    });

    it("accepts a fresh Google credential for the linked account", async () => {
        const ctx = makeAuthCtx();
        ctx.verifyGoogleCredential.mockResolvedValue({
            sub: "g-1",
            email: "x@example.test",
            name: "X",
        });
        const user = await withHash(
            await createUser({
                passwordHash: null,
                googleSub: "g-1",
                authProviders: ["google"],
            })
        );
        await expect(
            reauthenticate({ user, credential: "google-credential-value" }, ctx)
        ).resolves.toBeUndefined();
        expect(ctx.verifyGoogleCredential).toHaveBeenCalledWith(
            "google-credential-value"
        );
    });

    it("rejects a Google credential of another account or for an account without Google", async () => {
        const ctx = makeAuthCtx();
        ctx.verifyGoogleCredential.mockResolvedValue({
            sub: "someone-else",
            email: "x@example.test",
            name: "X",
        });
        const linked = await withHash(
            await createUser({
                googleSub: "g-1",
                authProviders: ["local", "google"],
            })
        );
        await expect(
            reauthenticate(
                { user: linked, credential: "google-credential-value" },
                ctx
            )
        ).rejects.toMatchObject({
            code: "REAUTH_REQUIRED",
        });
        const unlinked = await withHash(await createUser());
        await expect(
            reauthenticate(
                { user: unlinked, credential: "google-credential-value" },
                ctx
            )
        ).rejects.toMatchObject({
            code: "REAUTH_REQUIRED",
        });
    });

    it("lets a user with both methods use either", async () => {
        const ctx = makeAuthCtx();
        ctx.verifyGoogleCredential.mockResolvedValue({
            sub: "g-2",
            email: "x@example.test",
            name: "X",
        });
        const user = await withHash(
            await createUser({
                googleSub: "g-2",
                authProviders: ["local", "google"],
            })
        );
        await expect(
            reauthenticate({ user, currentPassword: TEST_PASSWORD }, ctx)
        ).resolves.toBeUndefined();
        await expect(
            reauthenticate({ user, credential: "google-credential-value" }, ctx)
        ).resolves.toBeUndefined();
    });
});
