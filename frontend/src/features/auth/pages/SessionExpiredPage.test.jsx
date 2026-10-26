import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import SessionExpiredPage from "@/features/auth/pages/SessionExpiredPage";
import { i18n } from "@/i18n";
import { anonymousAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { setMotionTier } from "@/test/motionTier";
import { renderAuthPage, where } from "@/test/renderAuthPage";

beforeEach(() => setMotionTier("reduced"));
afterEach(async () => {
    await i18n.changeLanguage("en");
});

const renderExpired = (options = {}) =>
    renderAuthPage(<SessionExpiredPage />, {
        path: "/session-expired",
        preloadedState: { auth: anonymousAuth },
        ...options,
    });

describe("SessionExpiredPage", () => {
    it("explains what happened with one h1 and a sign-in action", async () => {
        const { container } = renderExpired();
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "Your session ended",
            })
        ).toBeInTheDocument();
        expect(
            screen.getByText(/For your security you were signed out/)
        ).toBeInTheDocument();
        expect(screen.getAllByRole("main")).toHaveLength(1);
        expect(document.title).toBe("Your session ended | SAMARTH AI");
        await expectAccessible(container);
    });

    it("passes a safe return path on to the sign-in page", async () => {
        const user = userEvent.setup();
        const { router } = renderExpired({ state: { returnTo: "/gaps" } });
        await user.click(screen.getByRole("link", { name: "Sign in" }));
        await waitFor(() => expect(where(router)).toBe("/login"));
        expect(router.state.location.state).toEqual({ returnTo: "/gaps" });
    });

    it("drops an unsafe return path", async () => {
        const user = userEvent.setup();
        const { router } = renderExpired({
            state: { returnTo: "//evil.example" },
        });
        await user.click(screen.getByRole("link", { name: "Sign in" }));
        await waitFor(() => expect(where(router)).toBe("/login"));
        expect(router.state.location.state).toBeNull();
    });

    it("links home as the secondary action and renders in Hindi", async () => {
        await i18n.changeLanguage("hi");
        const { container } = renderExpired();
        expect(
            screen.getAllByRole("link", { name: /मुख्य पृष्ठ|होम|home/i })
                .length
        ).toBeGreaterThan(0);
        await expectAccessible(container);
    });
});
