import { http } from "msw";
import { describe, expect, it } from "vitest";
import { setupStore } from "@/app/store";
import {
    accountOpCleared,
    changeEmail,
    changePassword,
    confirmEmailChange,
    deleteAccount,
    forgotPassword,
    resetPassword,
    selectAccountOp,
    undoEmailChange,
    unlinkGoogle,
    validateResetToken,
} from "@/features/auth";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { makeUser } from "@/mocks/fixtures/user";
import { anonymousAuth, signedInAuth } from "@/test/authState";
import { setupMockServer } from "@/test/mockServerLifecycle";

const server = setupMockServer();

const failWith = (path, status, code, extra, method = "post") =>
    server.use(
        http[method](apiUrl(path), () => errorResponse(status, code, extra))
    );

describe("forgotPassword", () => {
    it("succeeds with the neutral message", async () => {
        const store = setupStore({ auth: anonymousAuth });
        const result = await store.dispatch(
            forgotPassword({ email: "ghost@example.test" })
        );
        expect(result.type).toBe("account/forgotPassword/fulfilled");
        expect(selectAccountOp(store.getState(), "forgotPassword")).toEqual({
            status: "succeeded",
            error: null,
        });
    });

    it("reports the per-IP limit with its cooldown", async () => {
        failWith("/auth/forgot-password", 429, "RATE_LIMITED", {
            headers: { "Retry-After": "120" },
        });
        const store = setupStore();
        const result = await store.dispatch(
            forgotPassword({ email: "a@example.test" })
        );
        expect(result.payload).toMatchObject({
            code: "RATE_LIMITED",
            retryAfterSec: 120,
        });
        expect(selectAccountOp(store.getState(), "forgotPassword").status).toBe(
            "failed"
        );
    });

    it("tracks the loading state and can clear an error", async () => {
        failWith("/auth/forgot-password", 400, "VALIDATION_ERROR");
        const store = setupStore();
        const pending = store.dispatch(forgotPassword({ email: "bad" }));
        expect(selectAccountOp(store.getState(), "forgotPassword").status).toBe(
            "loading"
        );
        await pending;
        store.dispatch(accountOpCleared("forgotPassword"));
        expect(selectAccountOp(store.getState(), "forgotPassword")).toEqual({
            status: "idle",
            error: null,
        });
    });
});

describe("validateResetToken and resetPassword", () => {
    it("validates a token without consuming it", async () => {
        const result = await setupStore().dispatch(
            validateResetToken({ token: "t" })
        );
        expect(result.payload).toEqual({ valid: true });
    });

    it.each(["RESET_TOKEN_INVALID"])(
        "answers %s identically for expired, used and unknown tokens",
        async (code) => {
            failWith("/auth/reset-password/validate", 400, code);
            const result = await setupStore().dispatch(
                validateResetToken({ token: "t" })
            );
            expect(result.payload).toMatchObject({ statusCode: 400, code });
        }
    );

    it("resets the password without signing anyone in (no auto-login)", async () => {
        const store = setupStore({ auth: anonymousAuth });
        const result = await store.dispatch(
            resetPassword({ token: "t", newPassword: "a-new-long-passphrase" })
        );
        expect(result.type).toBe("account/resetPassword/fulfilled");
        expect(store.getState().auth.user).toBeNull();
        expect(JSON.stringify(store.getState())).not.toContain(
            "a-new-long-passphrase"
        );
    });

    it.each([
        [400, "RESET_TOKEN_INVALID"],
        [400, "PASSWORD_POLICY"],
        [400, "PASSWORD_REUSED"],
        [429, "RATE_LIMITED"],
    ])("rejects %i %s", async (status, code) => {
        failWith("/auth/reset-password", status, code);
        const store = setupStore();
        const result = await store.dispatch(
            resetPassword({ token: "t", newPassword: "x" })
        );
        expect(result.payload).toMatchObject({ statusCode: status, code });
        expect(
            selectAccountOp(store.getState(), "resetPassword")
        ).toMatchObject({ status: "failed", error: { code } });
    });
});

describe("changePassword", () => {
    it("clears the must-change flag and the limited session", async () => {
        const store = setupStore({
            auth: signedInAuth(
                { mustChangePassword: true },
                { limitedSession: true }
            ),
        });
        await store.dispatch(
            changePassword({
                currentPassword: "old-password-1",
                newPassword: "new-password-1",
            })
        );
        const { auth } = store.getState();
        expect(auth.user.mustChangePassword).toBe(false);
        expect(auth.limitedSession).toBe(false);
    });

    it("promotes a limited session that has no user yet when the server returns one", async () => {
        const store = setupStore({
            auth: { ...anonymousAuth, limitedSession: true },
        });
        await store.dispatch(
            changePassword({ currentPassword: "old", newPassword: "new" })
        );
        expect(store.getState().auth.user).not.toBeNull();
        expect(store.getState().auth.limitedSession).toBe(false);
    });

    it.each([
        [401, "INVALID_CREDENTIALS"],
        [403, "REAUTH_REQUIRED"],
        [400, "PASSWORD_POLICY"],
        [400, "PASSWORD_REUSED"],
    ])("rejects %i %s and leaves the user as is", async (status, code) => {
        failWith("/auth/change-password", status, code);
        const store = setupStore({
            auth: signedInAuth({ mustChangePassword: true }),
        });
        const result = await store.dispatch(
            changePassword({ currentPassword: "x", newPassword: "y" })
        );
        expect(result.payload).toMatchObject({ code });
        expect(store.getState().auth.user.mustChangePassword).toBe(true);
    });
});

describe("email change", () => {
    it("accepts a change request neutrally", async () => {
        const result = await setupStore({ auth: signedInAuth() }).dispatch(
            changeEmail({ newEmail: "new@example.test", currentPassword: "x" })
        );
        expect(result.type).toBe("account/changeEmail/fulfilled");
    });

    it.each([
        [401, "INVALID_CREDENTIALS"],
        [403, "REAUTH_REQUIRED"],
        [403, "DOMAIN_NOT_ALLOWED"],
    ])("rejects %i %s", async (status, code) => {
        failWith("/auth/change-email", status, code);
        const result = await setupStore().dispatch(
            changeEmail({ newEmail: "x@example.test", currentPassword: "x" })
        );
        expect(result.payload.code).toBe(code);
    });

    it("confirms and undoes with a token in the body", async () => {
        const store = setupStore({ auth: signedInAuth() });
        expect(
            (await store.dispatch(confirmEmailChange({ token: "t" }))).type
        ).toBe("account/confirmEmailChange/fulfilled");
        expect(
            (await store.dispatch(undoEmailChange({ token: "t" }))).type
        ).toBe("account/undoEmailChange/fulfilled");
    });

    it.each([
        ["/auth/change-email/confirm", confirmEmailChange],
        ["/auth/change-email/undo", undoEmailChange],
    ])(
        "answers EMAIL_CHANGE_INVALID for a bad token on %s",
        async (path, thunk) => {
            failWith(path, 400, "EMAIL_CHANGE_INVALID");
            expect(
                (await setupStore().dispatch(thunk({ token: "bad" }))).payload
                    .code
            ).toBe("EMAIL_CHANGE_INVALID");
        }
    );
});

describe("unlinkGoogle", () => {
    it("updates the providers from the returned user", async () => {
        const store = setupStore({
            auth: signedInAuth({ authProviders: ["password", "google"] }),
        });
        await store.dispatch(unlinkGoogle({ credential: "fresh" }));
        expect(store.getState().auth.user.authProviders).toEqual(["password"]);
    });

    it("removes the provider locally when the server returns no user", async () => {
        server.use(http.delete(apiUrl("/auth/google"), () => okResponse(null)));
        const store = setupStore({
            auth: signedInAuth({ authProviders: ["password", "google"] }),
        });
        await store.dispatch(unlinkGoogle({ credential: "fresh" }));
        expect(store.getState().auth.user.authProviders).toEqual(["password"]);
    });

    it.each([
        [409, "AUTH_METHOD_REQUIRED"],
        [403, "REAUTH_REQUIRED"],
    ])("rejects %i %s", async (status, code) => {
        failWith("/auth/google", status, code, undefined, "delete");
        const store = setupStore({
            auth: signedInAuth({ authProviders: ["google"] }),
        });
        const result = await store.dispatch(
            unlinkGoogle({ credential: "fresh" })
        );
        expect(result.payload.code).toBe(code);
        expect(store.getState().auth.user.authProviders).toEqual(["google"]);
    });
});

describe("deleteAccount", () => {
    it("ends the session after scheduling deletion", async () => {
        const store = setupStore({ auth: signedInAuth(makeUser()) });
        await store.dispatch(deleteAccount({ currentPassword: "x" }));
        expect(store.getState().auth).toMatchObject({
            user: null,
            sessionEnd: "LOGOUT",
        });
    });

    it.each([
        [401, "INVALID_CREDENTIALS"],
        [403, "REAUTH_REQUIRED"],
        [409, "LAST_ADMIN"],
    ])("rejects %i %s and keeps the session", async (status, code) => {
        failWith("/auth/account", status, code, undefined, "delete");
        const store = setupStore({ auth: signedInAuth() });
        const result = await store.dispatch(
            deleteAccount({ currentPassword: "x" })
        );
        expect(result.payload.code).toBe(code);
        expect(store.getState().auth.user).not.toBeNull();
    });
});
