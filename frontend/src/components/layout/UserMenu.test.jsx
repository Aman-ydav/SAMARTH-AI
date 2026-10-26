import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { UserMenu } from "@/components/layout/UserMenu";
import { Toaster } from "@/components/ui/sonner";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { makeUser } from "@/mocks/fixtures/user";
import { signedInAuth } from "@/test/authState";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { expectAccessible } from "@/test/axeCheck";
import { renderRoutes } from "@/test/renderWithProviders";

const server = setupMockServer();
const user = makeUser({ name: "Asha Verma", role: "trainer" });

function renderMenu(overrides = {}) {
    const routes = [
        {
            path: "/dashboard",
            element: (
                <>
                    <UserMenu user={{ ...user, ...overrides }} />
                    <Toaster />
                </>
            ),
        },
        { path: "/login", element: <p>login screen</p> },
    ];
    return renderRoutes(routes, {
        route: "/dashboard",
        preloadedState: { auth: signedInAuth(overrides) },
    });
}

const openMenu = () =>
    userEvent.click(screen.getByRole("button", { name: "Account menu" }));

describe("UserMenu", () => {
    it("shows who is signed in with name, email and role in words", async () => {
        renderMenu();
        await openMenu();
        expect(screen.getByText("Asha Verma")).toBeInTheDocument();
        expect(screen.getByText("asha.verma@example.test")).toBeInTheDocument();
        expect(screen.getByText("Trainer")).toBeInTheDocument();
    });

    it("links to profile, security and sessions", async () => {
        renderMenu();
        await openMenu();
        expect(
            screen.getByRole("menuitem", { name: "Profile" })
        ).toHaveAttribute("href", "/settings/profile");
        expect(
            screen.getByRole("menuitem", { name: "Security" })
        ).toHaveAttribute("href", "/settings/security");
        expect(
            screen.getByRole("menuitem", { name: "Devices and sessions" })
        ).toHaveAttribute("href", "/settings/sessions");
    });

    it("falls back to the email name and initials when the profile has no name", async () => {
        renderMenu({ name: "" });
        await openMenu();
        expect(screen.getAllByText("asha.verma").length).toBeGreaterThan(0);
    });

    it("logs out through the thunk and then goes to /login", async () => {
        const { store, router } = renderMenu();
        await openMenu();
        await userEvent.click(
            screen.getByRole("menuitem", { name: "Log out" })
        );
        expect(await screen.findByText("login screen")).toBeInTheDocument();
        expect(router.state.location.pathname).toBe("/login");
        expect(store.getState().auth.user).toBeNull();
    });

    it("stays signed in and says so when logout fails on the network", async () => {
        server.use(
            http.post(apiUrl("/auth/logout"), () =>
                errorResponse(500, "SERVER_ERROR")
            )
        );
        const { store, router } = renderMenu();
        await openMenu();
        await userEvent.click(
            screen.getByRole("menuitem", { name: "Log out" })
        );
        expect(
            await screen.findByText(
                "The server ran into a problem. Please try again."
            )
        ).toBeInTheDocument();
        expect(router.state.location.pathname).toBe("/dashboard");
        expect(store.getState().auth.user).not.toBeNull();
        await openMenu();
        expect(screen.getByRole("menuitem", { name: "Log out" })).toBeEnabled();
    });

    it("asks before logging out of every device and does nothing on cancel", async () => {
        let calls = 0;
        server.use(
            http.post(apiUrl("/auth/logout-all"), () => {
                calls += 1;
                return okResponse(null);
            })
        );
        const { store } = renderMenu();
        await openMenu();
        await userEvent.click(
            screen.getByRole("menuitem", { name: "Log out of all devices" })
        );
        expect(
            await screen.findByRole("alertdialog", {
                name: "Log out of all devices?",
            })
        ).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(calls).toBe(0);
        expect(store.getState().auth.user).not.toBeNull();
    });

    it("logs out of all devices after confirmation", async () => {
        const { store, router } = renderMenu();
        await openMenu();
        await userEvent.click(
            screen.getByRole("menuitem", { name: "Log out of all devices" })
        );
        await userEvent.click(
            await screen.findByRole("button", { name: "Log out everywhere" })
        );
        expect(await screen.findByText("login screen")).toBeInTheDocument();
        expect(router.state.location.pathname).toBe("/login");
        expect(store.getState().auth.user).toBeNull();
    });

    it("passes an axe smoke test closed and open", async () => {
        const { container } = renderMenu();
        await expectAccessible(container);
        await openMenu();
        await expectAccessible(document.body);
    });
});
