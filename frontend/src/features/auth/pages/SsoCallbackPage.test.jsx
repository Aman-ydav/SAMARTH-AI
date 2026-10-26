import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import SsoCallbackPage from "@/features/auth/pages/SsoCallbackPage";
import { anonymousAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { setMotionTier } from "@/test/motionTier";
import { renderAuthPage } from "@/test/renderAuthPage";

beforeEach(() => setMotionTier("reduced"));

describe("SsoCallbackPage", () => {
    it("says it is a prototype stub, signs nobody in and never reads the callback parameters", async () => {
        const { container, store } = renderAuthPage(<SsoCallbackPage />, {
            path: "/sso/callback",
            entry: "/sso/callback?code=abc&state=xyz",
            preloadedState: { auth: anonymousAuth },
        });
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "Single sign-on is a prototype stub",
            })
        ).toBeInTheDocument();
        expect(
            screen.getByText(/No sign-in happens on this page/)
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Back to log in" })
        ).toHaveAttribute("href", "/login");
        expect(document.title).toBe("Signing you in | SAMARTH AI");
        expect(store.getState().auth.user).toBeNull();
        expect(container.textContent).not.toContain("abc");
        await expectAccessible(container);
    });
});
