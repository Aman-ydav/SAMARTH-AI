import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link } from "react-router";
import { describe, expect, it } from "vitest";
import { RootLayout } from "@/app/providers/RootLayout";
import { anonymousAuth } from "@/test/authState";
import { renderRoutes } from "@/test/renderWithProviders";

function Page({ name, to }) {
    return (
        <main id="main-content" tabIndex={-1}>
            <h1>{name}</h1>
            {to ? <Link to={to}>go next</Link> : null}
        </main>
    );
}

const routes = [
    {
        element: <RootLayout />,
        children: [
            {
                path: "/",
                element: <Page name="first page" to="/about" />,
                handle: { title: "common:pages.landing" },
            },
            {
                path: "/about",
                element: <Page name="about page" />,
                handle: { title: "common:pages.about" },
            },
            { path: "/untitled", element: <Page name="untitled page" /> },
        ],
    },
];

describe("RootLayout", () => {
    it("gates rendering on hydration", () => {
        renderRoutes(routes, {
            preloadedState: { auth: { ...anonymousAuth, bootstrapped: false } },
        });
        expect(screen.queryByText("first page")).not.toBeInTheDocument();
    });

    it("renders a skip link as the first focusable element", async () => {
        renderRoutes(routes, { preloadedState: { auth: anonymousAuth } });
        await screen.findByText("first page");
        await userEvent.tab();
        expect(
            screen.getByRole("link", { name: "Skip to main content" })
        ).toHaveFocus();
        expect(
            screen.getByRole("link", { name: "Skip to main content" })
        ).toHaveAttribute("href", "#main-content");
    });

    it("sets the document title from the route handle", async () => {
        const { router } = renderRoutes(routes, {
            route: "/about",
            preloadedState: { auth: anonymousAuth },
        });
        await screen.findByText("about page");
        expect(document.title).toBe("About | SAMARTH AI");
        await router.navigate("/");
        await screen.findByText("first page");
        expect(document.title).toBe("SAMARTH AI | SAMARTH AI");
    });

    it("falls back to the brand name for routes without a title", async () => {
        renderRoutes(routes, {
            route: "/untitled",
            preloadedState: { auth: anonymousAuth },
        });
        await screen.findByText("untitled page");
        expect(document.title).toBe("SAMARTH AI");
    });

    it("moves focus to <main> after a navigation but not on first render", async () => {
        renderRoutes(routes, { preloadedState: { auth: anonymousAuth } });
        const firstMain = await screen.findByRole("main");
        expect(firstMain).not.toHaveFocus();
        await userEvent.click(screen.getByRole("link", { name: "go next" }));
        await screen.findByText("about page");
        expect(screen.getByRole("main")).toHaveFocus();
    });

    it("shows the offline banner above the page", async () => {
        const { store } = renderRoutes(routes, {
            preloadedState: { auth: anonymousAuth },
        });
        await screen.findByText("first page");
        const { offlineChanged } = await import("@/features/preferences");
        const { act } = await import("@testing-library/react");
        act(() => {
            store.dispatch(offlineChanged(true));
        });
        expect(screen.getByRole("status")).toHaveTextContent(/offline/i);
    });
});
