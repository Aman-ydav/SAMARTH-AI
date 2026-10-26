import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { anonymousAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { renderRoutes } from "@/test/renderWithProviders";

const routes = [
    {
        element: <MarketingLayout />,
        children: [
            {
                path: "/",
                element: (
                    <main id="main-content" tabIndex={-1}>
                        <h1>Landing content</h1>
                    </main>
                ),
                handle: { title: "common:pages.landing" },
            },
            {
                path: "/about",
                element: (
                    <main id="main-content" tabIndex={-1}>
                        <h1>About content</h1>
                    </main>
                ),
            },
            { path: "/bare", element: <h1>Bare content</h1> },
        ],
    },
];

const render = (route = "/") =>
    renderRoutes(routes, { route, preloadedState: { auth: anonymousAuth } });

describe("MarketingLayout", () => {
    it("frames the page with a banner and a footer around the page own main landmark", async () => {
        render();
        expect(await screen.findByText("Landing content")).toBeInTheDocument();
        expect(screen.getByRole("banner")).toBeInTheDocument();
        expect(screen.getAllByRole("main")).toHaveLength(1);
        expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    });

    it("adds no landmark of its own: a page without main gets none, so pages never end up with two", async () => {
        render("/bare");
        expect(await screen.findByText("Bare content")).toBeInTheDocument();
        expect(screen.queryByRole("main")).not.toBeInTheDocument();
    });

    it("leaves the page main focusable by id for the skip link", async () => {
        render();
        const main = screen.getByRole("main");
        expect(main).toHaveAttribute("id", "main-content");
        expect(main).toHaveAttribute("tabindex", "-1");
        expect(within(main).getByText("Landing content")).toBeInTheDocument();
    });

    it("keeps the navbar and footer while navigating between pages", async () => {
        const { router } = render();
        await screen.findByText("Landing content");
        await router.navigate("/about");
        expect(await screen.findByText("About content")).toBeInTheDocument();
        expect(screen.getByRole("banner")).toBeInTheDocument();
        expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    });

    it("has the navbar before the main content in tab order", async () => {
        render();
        await screen.findByText("Landing content");
        const banner = screen.getByRole("banner");
        const main = screen.getByRole("main");
        expect(
            banner.compareDocumentPosition(main) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });

    it("passes an axe smoke test", async () => {
        const { container } = render();
        await screen.findByText("Landing content");
        await expectAccessible(container);
    });
});
