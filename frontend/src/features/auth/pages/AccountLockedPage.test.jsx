import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AccountLockedPage from "@/features/auth/pages/AccountLockedPage";
import { i18n } from "@/i18n";
import { anonymousAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { setMotionTier } from "@/test/motionTier";
import { renderAuthPage } from "@/test/renderAuthPage";

beforeEach(() => {
    setMotionTier("reduced");
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
});
afterEach(async () => {
    vi.useRealTimers();
    await i18n.changeLanguage("en");
});

const renderLocked = (lockout, options = {}) =>
    renderAuthPage(<AccountLockedPage />, {
        path: "/account-locked",
        preloadedState: { auth: { ...anonymousAuth, lockout } },
        ...options,
    });

async function advance(ms) {
    await act(async () => {});
    act(() => {
        vi.advanceTimersByTime(ms);
    });
}

describe("AccountLockedPage", () => {
    it("counts down from the stored deadline and offers a password reset", async () => {
        const { container } = renderLocked({ until: Date.now() + 125000 });
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "Account temporarily locked",
            })
        ).toBeInTheDocument();
        expect(
            screen.getByText(/You can try again in 2:05/)
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Reset password" })
        ).toHaveAttribute("href", "/forgot-password");
        expect(
            screen.getByRole("link", { name: "Back to log in" })
        ).toHaveAttribute("href", "/login");
        await advance(5000);
        expect(
            screen.getByText(/You can try again in 2:00/)
        ).toBeInTheDocument();
        await expectAccessible(container);
    });

    it("switches to the unlocked state when the time is up and moves focus to it", async () => {
        renderLocked({ until: Date.now() + 3000 });
        await advance(4000);
        const title = await screen.findByRole("heading", {
            name: "You can sign in again",
        });
        expect(title).toHaveFocus();
        expect(
            screen.getByRole("link", { name: "Back to log in" })
        ).toHaveAttribute("href", "/login");
        expect(document.title).toBe("You can sign in again | SAMARTH AI");
    });

    it("shows generic advice, with no countdown, when there is no stored lock", () => {
        renderLocked(null);
        expect(
            screen.getByText(/Please wait a little while/)
        ).toBeInTheDocument();
        expect(screen.queryByText(/2:05/)).not.toBeInTheDocument();
    });

    it("carries a safe return path back to log in", () => {
        renderLocked(
            { until: Date.now() + 60000 },
            { state: { returnTo: "/gaps" } }
        );
        expect(
            screen.getByRole("link", { name: "Back to log in" })
        ).toHaveAttribute("href", "/login");
    });

    it("renders in Hindi", async () => {
        await i18n.changeLanguage("hi");
        const { container } = renderLocked({ until: Date.now() + 60000 });
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "खाता अस्थायी रूप से लॉक है",
            })
        ).toBeInTheDocument();
        await expectAccessible(container);
    });
});
