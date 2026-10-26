import { http } from "msw";
import { describe, expect, it } from "vitest";
import * as authApi from "@/features/auth/api/authApi";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { makeUser } from "@/mocks/fixtures/user";
import { setupMockServer } from "@/test/mockServerLifecycle";

const server = setupMockServer();

function capture(method, path, response = () => okResponse(null)) {
    const seen = {
        calls: 0,
        body: undefined,
        headers: undefined,
        params: undefined,
    };
    server.use(
        http[method](apiUrl(path), async ({ request, params }) => {
            seen.calls += 1;
            seen.params = params;
            seen.headers = request.headers;
            const text = await request.text();
            seen.body = text ? JSON.parse(text) : undefined;
            return response();
        })
    );
    return seen;
}

describe("authApi: endpoints, bodies and unwrapping", () => {
    it("register posts the body and returns the neutral message", async () => {
        const seen = capture("post", "/auth/register", () =>
            okResponse(null, { status: 202, message: "Neutral" })
        );
        const result = await authApi.register({
            name: "A",
            email: "a@example.test",
            password: "p",
            acceptTerms: true,
        });
        expect(seen.body).toEqual({
            name: "A",
            email: "a@example.test",
            password: "p",
            acceptTerms: true,
        });
        expect(result).toEqual({ message: "Neutral" });
    });

    it("verifyEmail sends only the token in the body", async () => {
        const seen = capture("post", "/auth/verify-email", () =>
            okResponse({ user: makeUser() })
        );
        const data = await authApi.verifyEmail({ token: "abc" });
        expect(seen.body).toEqual({ token: "abc" });
        expect(data.user.email).toBe("asha.verma@example.test");
    });

    it("never puts a token in the URL", async () => {
        let url = "";
        server.use(
            http.post(apiUrl("/auth/verify-email"), ({ request }) => {
                url = request.url;
                return okResponse({ user: makeUser() });
            })
        );
        await authApi.verifyEmail({ token: "secret-token" });
        expect(url).not.toContain("secret-token");
        expect(url).not.toContain("?");
    });

    it("resendVerification, forgotPassword and resetPassword return messages", async () => {
        capture("post", "/auth/resend-verification", () =>
            okResponse(null, { message: "m1" })
        );
        capture("post", "/auth/forgot-password", () =>
            okResponse(null, { message: "m2" })
        );
        const reset = capture("post", "/auth/reset-password", () =>
            okResponse(null, { message: "m3" })
        );
        expect(
            await authApi.resendVerification({ email: "a@example.test" })
        ).toEqual({ message: "m1" });
        expect(
            await authApi.forgotPassword({ email: "a@example.test" })
        ).toEqual({ message: "m2" });
        expect(
            await authApi.resetPassword({ token: "t", newPassword: "n" })
        ).toEqual({ message: "m3" });
        expect(reset.body).toEqual({ token: "t", newPassword: "n" });
    });

    it("validateResetToken posts the token in the body", async () => {
        const seen = capture("post", "/auth/reset-password/validate", () =>
            okResponse({ valid: true })
        );
        expect(await authApi.validateResetToken({ token: "t" })).toEqual({
            valid: true,
        });
        expect(seen.body).toEqual({ token: "t" });
    });

    it("login and loginWithGoogle return the session data", async () => {
        const login = capture("post", "/auth/login", () =>
            okResponse({ user: makeUser(), needsOnboarding: false })
        );
        const google = capture("post", "/auth/google", () =>
            okResponse({ user: makeUser(), needsOnboarding: true })
        );
        expect(
            (
                await authApi.login({
                    email: "a@example.test",
                    password: "p",
                    rememberMe: true,
                })
            ).needsOnboarding
        ).toBe(false);
        expect(
            (await authApi.loginWithGoogle({ credential: "c", nonce: "n" }))
                .needsOnboarding
        ).toBe(true);
        expect(login.body).toMatchObject({ rememberMe: true });
        expect(google.body).toEqual({ credential: "c", nonce: "n" });
    });

    it("logout and logout-all resolve to null", async () => {
        capture("post", "/auth/logout");
        capture("post", "/auth/logout-all");
        expect(await authApi.logout()).toBeNull();
        expect(await authApi.logoutAll()).toBeNull();
    });

    it("refresh posts without a body", async () => {
        const seen = capture("post", "/auth/refresh");
        await authApi.refresh();
        expect(seen.calls).toBe(1);
        expect(seen.body).toBeUndefined();
    });

    it("getMe unwraps the user payload", async () => {
        capture("get", "/auth/me", () =>
            okResponse({ user: makeUser({ name: "Meera" }) })
        );
        expect((await authApi.getMe()).user.name).toBe("Meera");
    });

    it("change-password, change-email, confirm and undo use their endpoints", async () => {
        const password = capture("post", "/auth/change-password", () =>
            okResponse({ user: makeUser() })
        );
        const email = capture("post", "/auth/change-email", () =>
            okResponse(null, { status: 202, message: "m" })
        );
        capture("post", "/auth/change-email/confirm", () =>
            okResponse({ user: makeUser() })
        );
        const undo = capture("post", "/auth/change-email/undo", () =>
            okResponse({ user: makeUser() })
        );
        await authApi.changePassword({
            currentPassword: "a",
            newPassword: "b",
        });
        expect(
            await authApi.changeEmail({
                newEmail: "n@example.test",
                currentPassword: "a",
            })
        ).toEqual({ message: "m" });
        await authApi.confirmEmailChange({ token: "t" });
        await authApi.undoEmailChange({ token: "u" });
        expect(password.body).toEqual({
            currentPassword: "a",
            newPassword: "b",
        });
        expect(email.body).toEqual({
            newEmail: "n@example.test",
            currentPassword: "a",
        });
        expect(undo.body).toEqual({ token: "u" });
    });

    it("acceptInvite posts the token, name and password", async () => {
        const seen = capture("post", "/auth/accept-invite", () =>
            okResponse({ user: makeUser() })
        );
        await authApi.acceptInvite({ token: "t", name: "N", password: "p" });
        expect(seen.body).toEqual({ token: "t", name: "N", password: "p" });
    });

    it("DELETE endpoints send their body", async () => {
        const google = capture("delete", "/auth/google", () =>
            okResponse({ user: makeUser() })
        );
        const account = capture("delete", "/auth/account", () =>
            okResponse(null)
        );
        await authApi.unlinkGoogle({ credential: "fresh" });
        await authApi.deleteAccount({ currentPassword: "p" });
        expect(google.body).toEqual({ credential: "fresh" });
        expect(account.body).toEqual({ currentPassword: "p" });
    });

    it("lists sessions from an array or an items wrapper", async () => {
        server.use(
            http.get(apiUrl("/auth/sessions"), () => okResponse([{ id: "1" }]))
        );
        expect(await authApi.listSessions()).toEqual([{ id: "1" }]);
        server.use(
            http.get(apiUrl("/auth/sessions"), () =>
                okResponse({ items: [{ id: "2" }] })
            )
        );
        expect(await authApi.listSessions()).toEqual([{ id: "2" }]);
        server.use(http.get(apiUrl("/auth/sessions"), () => okResponse(null)));
        expect(await authApi.listSessions()).toEqual([]);
    });

    it("revokeSession encodes the id segment", async () => {
        const seen = capture("delete", "/auth/sessions/:id");
        await authApi.revokeSession({ id: "a b/c" });
        expect(seen.params.id).toBe("a b/c");
    });

    it("propagates API errors untouched for the thunk to normalise", async () => {
        server.use(
            http.post(apiUrl("/auth/login"), () =>
                errorResponse(401, "INVALID_CREDENTIALS")
            )
        );
        await expect(
            authApi.login({ email: "a@example.test", password: "p" })
        ).rejects.toMatchObject({
            statusCode: 401,
            code: "INVALID_CREDENTIALS",
        });
    });
});
