import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/features/auth/pages/LoginPage";
import { i18n } from "@/i18n";
import { anonymousAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { setMotionTier } from "@/test/motionTier";
import { renderAuthPage, where } from "@/test/renderAuthPage";

vi.mock("@/lib/env", async (importOriginal) => {
    const actual = await importOriginal();
    return { env: { ...actual.env, googleEnabled: false, googleClientId: "" } };
});

setupMockServer();

beforeEach(() => setMotionTier("reduced"));
afterEach(async () => {
    await i18n.changeLanguage("en");
});

const renderLogin = (options = {}) =>
    renderAuthPage(<LoginPage />, {
        path: "/login",
        preloadedState: { auth: anonymousAuth },
        ...options,
    });

describe("LoginPage", () => {
    it("has one h1, one main landmark, the form and a sign-up link", async () => {
        const { container } = renderLogin();
        expect(
            screen.getByRole("heading", { level: 1, name: "Welcome back" })
        ).toBeInTheDocument();
        expect(screen.getAllByRole("main")).toHaveLength(1);
        expect(
            screen.getByRole("link", { name: "Create account" })
        ).toHaveAttribute("href", "/signup");
        expect(document.title).toBe("Welcome back | SAMARTH AI");
        await expectAccessible(container);
    });

    it("shows the password-updated notice carried from the reset flow", () => {
        renderLogin({ state: { notice: "passwordReset" } });
        expect(
            screen.getByText(
                "Your password was updated. Log in with your new password."
            )
        ).toBeInTheDocument();
    });

    it.each([["constructor"], ["<script>"], [42]])(
        "ignores an unknown notice name (%s)",
        (notice) => {
            renderLogin({ state: { notice } });
            expect(
                screen.queryByText(/Your password was updated/)
            ).not.toBeInTheDocument();
        }
    );

    it("passes a safe return path on to sign-up", async () => {
        const user = userEvent.setup();
        const { router } = renderLogin({ state: { returnTo: "/gaps" } });
        await user.click(screen.getByRole("link", { name: "Create account" }));
        await waitFor(() => expect(where(router)).toBe("/signup"));
        expect(router.state.location.state).toEqual({ returnTo: "/gaps" });
    });

    it("shows the restored-account confirmation after a reactivated sign-in and continues on acknowledge", async () => {
        const user = userEvent.setup();
        const { router, store } = renderLogin({
            preloadedState: {
                auth: {
                    ...anonymousAuth,
                    user: {
                        id: "1",
                        email: "asha@example.test",
                        role: "learner",
                        needsOnboarding: false,
                    },
                    reactivated: true,
                },
            },
        });
        expect(
            screen.getByRole("heading", { level: 1, name: "Account restored" })
        ).toBeInTheDocument();
        expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
        expect(document.title).toBe("Account restored | SAMARTH AI");
        await user.click(screen.getByRole("button", { name: "Continue" }));
        await waitFor(() => expect(where(router)).toBe("/dashboard"));
        expect(store.getState().auth.reactivated).toBe(false);
    });

    it("renders in Hindi", async () => {
        await i18n.changeLanguage("hi");
        const { container } = renderLogin();
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "वापसी पर स्वागत है",
            })
        ).toBeInTheDocument();
        await expectAccessible(container);
    });
});
