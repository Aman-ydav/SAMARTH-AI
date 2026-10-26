import { http } from "msw";
import { describe, expect, it } from "vitest";
import { setupStore } from "@/app/store";
import {
    acceptInvite,
    registerUser,
    registrationOpCleared,
    resendVerification,
    selectPendingEmail,
    selectRegistrationOp,
    verifyEmail,
} from "@/features/auth";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { anonymousAuth } from "@/test/authState";
import { setupMockServer } from "@/test/mockServerLifecycle";

const server = setupMockServer();

const failWith = (path, status, code, extra, method = "post") =>
    server.use(
        http[method](apiUrl(path), () => errorResponse(status, code, extra))
    );

describe("registerUser", () => {
    it("remembers the pending email and tracks the operation", async () => {
        const store = setupStore({ auth: anonymousAuth });
        const pending = store.dispatch(
            registerUser({
                name: "Asha",
                email: "asha@example.test",
                password: "a-long-passphrase",
                acceptTerms: true,
            })
        );
        expect(
            selectRegistrationOp(store.getState(), "registerUser").status
        ).toBe("loading");
        const result = await pending;
        expect(result.type).toBe("registration/registerUser/fulfilled");
        expect(selectRegistrationOp(store.getState(), "registerUser")).toEqual({
            status: "succeeded",
            error: null,
        });
        expect(selectPendingEmail(store.getState())).toBe("asha@example.test");
    });

    it.each([
        [400, "VALIDATION_ERROR"],
        [400, "PASSWORD_POLICY"],
        [403, "DOMAIN_NOT_ALLOWED"],
        [429, "RATE_LIMITED"],
    ])("stores the %i %s failure on the operation", async (status, code) => {
        failWith("/auth/register", status, code, {
            errors: [{ field: "email", message: "bad" }],
        });
        const store = setupStore();
        const result = await store.dispatch(
            registerUser({ email: "x@example.test" })
        );
        expect(result.payload).toMatchObject({ statusCode: status, code });
        expect(
            selectRegistrationOp(store.getState(), "registerUser")
        ).toMatchObject({
            status: "failed",
            error: { code },
        });
        expect(selectPendingEmail(store.getState())).toBeNull();
    });
});

describe("verifyEmail and resendVerification", () => {
    it("starts the session after a verified email", async () => {
        const store = setupStore({
            auth: { ...anonymousAuth, pendingEmail: "asha@example.test" },
        });
        await store.dispatch(verifyEmail({ token: "one-time" }));
        const { auth } = store.getState();
        expect(auth.user).toMatchObject({
            emailVerified: true,
            needsOnboarding: true,
        });
        expect(auth).toMatchObject({ pendingEmail: null, sessionEnd: null });
        expect(JSON.stringify(auth)).not.toContain("one-time");
    });

    it("fails generically for expired, used or unknown tokens", async () => {
        failWith("/auth/verify-email", 400, "VERIFY_TOKEN_INVALID");
        const store = setupStore();
        const result = await store.dispatch(verifyEmail({ token: "x" }));
        expect(result.payload.code).toBe("VERIFY_TOKEN_INVALID");
        expect(store.getState().auth.user).toBeNull();
    });

    it("resends with a neutral response and keeps the email", async () => {
        const store = setupStore();
        await store.dispatch(
            resendVerification({ email: "asha@example.test" })
        );
        expect(selectPendingEmail(store.getState())).toBe("asha@example.test");
    });

    it("surfaces the cooldown on rate limiting", async () => {
        failWith("/auth/resend-verification", 429, "RATE_LIMITED", {
            headers: { "Retry-After": "60" },
        });
        const store = setupStore();
        const result = await store.dispatch(
            resendVerification({ email: "asha@example.test" })
        );
        expect(result.payload).toMatchObject({
            code: "RATE_LIMITED",
            retryAfterSec: 60,
        });
    });

    it("rejects a verification response without a user", async () => {
        server.use(
            http.post(apiUrl("/auth/verify-email"), () => okResponse({}))
        );
        const result = await setupStore().dispatch(verifyEmail({ token: "x" }));
        expect(result.payload.code).toBe("INVALID_RESPONSE");
    });
});

describe("acceptInvite", () => {
    it("starts the session with the invited role", async () => {
        const store = setupStore();
        await store.dispatch(
            acceptInvite({
                token: "t",
                name: "Dr Rao",
                password: "a-long-passphrase",
            })
        );
        expect(store.getState().auth.user).toMatchObject({
            role: "trainer",
            needsOnboarding: true,
        });
    });

    it.each(["INVITE_INVALID", "PASSWORD_POLICY", "DOMAIN_NOT_ALLOWED"])(
        "rejects %s",
        async (code) => {
            failWith(
                "/auth/accept-invite",
                code === "INVITE_INVALID" ? 400 : 403,
                code
            );
            const result = await setupStore().dispatch(
                acceptInvite({ token: "t" })
            );
            expect(result.payload.code).toBe(code);
        }
    );
});

describe("operation records", () => {
    it("starts idle, can be cleared, and records unknown failures", () => {
        const store = setupStore();
        expect(selectRegistrationOp(store.getState(), "registerUser")).toEqual({
            status: "idle",
            error: null,
        });
        store.dispatch(
            registerUser.rejected(new Error("boom"), "request-1", {
                email: "a@example.test",
            })
        );
        expect(
            selectRegistrationOp(store.getState(), "registerUser")
        ).toMatchObject({ status: "failed", error: { code: "UNKNOWN" } });
        store.dispatch(registrationOpCleared("registerUser"));
        expect(
            selectRegistrationOp(store.getState(), "registerUser").status
        ).toBe("idle");
    });
});
