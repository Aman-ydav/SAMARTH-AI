import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import AccountSuspendedPage from "@/features/auth/pages/AccountSuspendedPage";
import { i18n } from "@/i18n";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { anonymousAuth, signedInAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { setMotionTier } from "@/test/motionTier";
import { renderAuthPage, where } from "@/test/renderAuthPage";

const server = setupMockServer();

beforeEach(() => setMotionTier("reduced"));
afterEach(async () => {
    await i18n.changeLanguage("en");
});

const renderSuspended = (auth = anonymousAuth) =>
    renderAuthPage(<AccountSuspendedPage />, {
        path: "/account-suspended",
        preloadedState: { auth },
    });

describe("AccountSuspendedPage", () => {
    it("explains the suspension and points to support without leaking account details", async () => {
        const { container } = renderSuspended();
        expect(
            screen.getByRole("heading", { level: 1, name: "Account suspended" })
        ).toBeInTheDocument();
        expect(
            screen.getByText(/An administrator has suspended this account/)
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Contact support" })
        ).toBeInTheDocument();
        expect(document.title).toBe("Account suspended | SAMARTH AI");
        await expectAccessible(container);
    });

    it("offers a way back to log in to an anonymous visitor", () => {
        renderSuspended();
        expect(
            screen.getByRole("link", { name: "Back to log in" })
        ).toHaveAttribute("href", "/login");
        expect(
            screen.queryByRole("button", { name: "Log out" })
        ).not.toBeInTheDocument();
    });

    it("logs a signed-in visitor out and goes to /login", async () => {
        const user = userEvent.setup();
        const { router, store } = renderSuspended(signedInAuth());
        await user.click(screen.getByRole("button", { name: "Log out" }));
        await waitFor(() => expect(where(router)).toBe("/login"));
        expect(store.getState().auth.user).toBeNull();
    });

    it("stays put and says so when logout fails (logout never lies)", async () => {
        server.use(
            http.post(apiUrl("/auth/logout"), () =>
                errorResponse(500, "SERVER_ERROR")
            )
        );
        const user = userEvent.setup();
        const { router, store } = renderSuspended(signedInAuth());
        await user.click(screen.getByRole("button", { name: "Log out" }));
        expect(
            await screen.findByText(/The server ran into a problem/)
        ).toBeInTheDocument();
        expect(where(router)).toBe("/account-suspended");
        expect(store.getState().auth.user).not.toBeNull();
    });

    it("treats an already-ended session as logged out", async () => {
        server.use(
            http.post(apiUrl("/auth/logout"), () =>
                errorResponse(401, "AUTH_REQUIRED")
            )
        );
        const user = userEvent.setup();
        const { router } = renderSuspended(signedInAuth());
        await user.click(screen.getByRole("button", { name: "Log out" }));
        await waitFor(() => expect(where(router)).toBe("/login"));
    });

    it("renders in Hindi", async () => {
        server.use(http.post(apiUrl("/auth/logout"), () => okResponse(null)));
        await i18n.changeLanguage("hi");
        const { container } = renderSuspended();
        expect(
            screen.getByRole("heading", { level: 1, name: "खाता निलंबित है" })
        ).toBeInTheDocument();
        await expectAccessible(container);
    });
});
