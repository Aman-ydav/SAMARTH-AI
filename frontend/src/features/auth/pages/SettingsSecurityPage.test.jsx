import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import SettingsSecurityPage from "@/features/auth/pages/SettingsSecurityPage";
import { i18n } from "@/i18n";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { signedInAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { renderPage } from "@/test/pageHarness";

const server = setupMockServer();

afterEach(async () => {
    await i18n.changeLanguage("en");
});

function renderSecurity(userOverrides = {}) {
    return renderPage(SettingsSecurityPage, {
        path: "/settings/security",
        preloadedState: { auth: signedInAuth(userOverrides) },
    });
}

describe("SettingsSecurityPage", () => {
    it("lists every security section under one h1 inside one main landmark", async () => {
        const { container } = renderSecurity();
        expect(
            screen.getByRole("heading", { level: 1, name: "Security" })
        ).toBeInTheDocument();
        expect(screen.getAllByRole("main")).toHaveLength(1);
        expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
        const headings = screen
            .getAllByRole("heading", { level: 2 })
            .map((heading) => heading.textContent);
        expect(headings).toEqual([
            "Email address",
            "Password",
            "Log out of all devices",
            "Delete account",
        ]);
        await expectAccessible(container);
    });

    it("marks Security as the current settings section and links the others", () => {
        renderSecurity();
        const nav = screen.getByRole("navigation", {
            name: "Account settings sections",
        });
        expect(
            within(nav).getByRole("link", { name: "Security" })
        ).toHaveAttribute("aria-current", "page");
        expect(
            within(nav).getByRole("link", { name: "Profile" })
        ).toHaveAttribute("href", "/settings/profile");
        expect(
            within(nav).getByRole("link", { name: "Devices" })
        ).toHaveAttribute("href", "/settings/sessions");
    });

    it("hides the Google section when Google sign-in is not configured and the account is not linked", () => {
        renderSecurity();
        expect(
            screen.queryByRole("heading", { name: "Google sign-in" })
        ).not.toBeInTheDocument();
    });

    it("shows the Google section for a linked account even without a client id", () => {
        renderSecurity({ authProviders: ["password", "google"] });
        expect(
            screen.getByRole("heading", { level: 2, name: "Google sign-in" })
        ).toBeVisible();
    });

    it("logs out of all devices after confirming and lands on the log in page", async () => {
        const user = userEvent.setup();
        const { router, store } = renderSecurity();
        await user.click(
            screen.getByRole("button", { name: "Log out of all devices" })
        );
        const dialog = await screen.findByRole("alertdialog");
        await user.click(
            within(dialog).getByRole("button", { name: "Log out everywhere" })
        );
        await waitFor(() =>
            expect(router.state.location.pathname).toBe("/login")
        );
        expect(store.getState().auth.user).toBeNull();
    });

    it("keeps the person signed in and says so when log out everywhere fails", async () => {
        server.use(
            http.post(apiUrl("/auth/logout-all"), () =>
                errorResponse(503, "SERVER_ERROR")
            )
        );
        const user = userEvent.setup();
        const { router, store } = renderSecurity();
        await user.click(
            screen.getByRole("button", { name: "Log out of all devices" })
        );
        await user.click(
            within(await screen.findByRole("alertdialog")).getByRole("button", {
                name: "Log out everywhere",
            })
        );
        await waitFor(() =>
            expect(
                screen.getByRole("button", { name: "Log out of all devices" })
            ).toBeEnabled()
        );
        expect(router.state.location.pathname).toBe("/settings/security");
        expect(store.getState().auth.user).not.toBeNull();
    });

    it("cancelling the log out dialog sends nothing", async () => {
        let calls = 0;
        server.use(
            http.post(apiUrl("/auth/logout-all"), () => {
                calls += 1;
                return okResponse(null);
            })
        );
        const user = userEvent.setup();
        renderSecurity();
        await user.click(
            screen.getByRole("button", { name: "Log out of all devices" })
        );
        await user.click(
            within(await screen.findByRole("alertdialog")).getByRole("button", {
                name: "Cancel",
            })
        );
        await waitFor(() =>
            expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
        );
        expect(calls).toBe(0);
    });
});

describe("SettingsSecurityPage Hindi", () => {
    it("renders in Hindi without accessibility violations", async () => {
        await i18n.changeLanguage("hi");
        const { container } = renderSecurity();
        expect(
            screen.getByRole("heading", { level: 1, name: "सुरक्षा" })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { level: 2, name: "ईमेल पता" })
        ).toBeVisible();
        await expectAccessible(container);
    });
});
