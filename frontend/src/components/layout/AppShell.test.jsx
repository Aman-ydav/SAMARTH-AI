import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/AppShell";
import { i18n } from "@/i18n";
import { signedInAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { renderRoutes } from "@/test/renderWithProviders";
import { setupMockServer } from "@/test/mockServerLifecycle";

setupMockServer();

const page = (text) => (
    <main id="main-content" tabIndex={-1}>
        <h1>{text}</h1>
    </main>
);
const routes = [
    {
        element: <AppShell />,
        children: [
            {
                path: "/dashboard",
                element: page("Dashboard page"),
                handle: { title: "common:pages.dashboard" },
            },
            {
                path: "/gaps",
                element: page("Gaps page"),
                handle: { title: "nav:sidebar.gaps" },
            },
            {
                path: "/admin/users",
                element: page("Users page"),
                handle: { title: "nav:sidebar.users" },
            },
            {
                path: "/trainer/content/:id",
                element: page("Content page"),
                handle: { title: "nav:sidebar.content" },
            },
        ],
    },
    { path: "/login", element: page("Login page") },
];

function renderShell({ route = "/dashboard", role = "learner" } = {}) {
    return renderRoutes(routes, {
        route,
        preloadedState: { auth: signedInAuth({ role }) },
    });
}

const trigger = () =>
    within(screen.getByRole("banner")).getByRole("button", {
        name: "Toggle sidebar",
    });
const sidebarNav = () =>
    screen.getByRole("navigation", { name: "App navigation" });
const setViewport = (isMobile) => {
    window.matchMedia = vi.fn((query) => ({
        matches: isMobile,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    }));
};

describe("AppShell frame", () => {
    beforeEach(() => window.localStorage.clear());
    afterEach(async () => {
        window.localStorage.clear();
        setViewport(false);
        await i18n.changeLanguage("en");
    });

    it("leaves the single main landmark to the page, which sits beside a topbar banner and the sidebar", async () => {
        renderShell();
        const main = screen.getByRole("main");
        expect(main).toHaveAttribute("id", "main-content");
        expect(main).toHaveAttribute("tabindex", "-1");
        expect(
            within(main).getByRole("heading", {
                level: 1,
                name: "Dashboard page",
            })
        ).toBeInTheDocument();
        expect(screen.getAllByRole("main")).toHaveLength(1);
        expect(screen.getByRole("banner")).toBeInTheDocument();
        expect(sidebarNav()).toBeInTheDocument();
    });

    it("shows the dismissible prototype notice and keeps it dismissed while navigating", async () => {
        const { router } = renderShell();
        expect(
            screen.getByText(
                "Prototype for SIH26101. Not an official Government of India website."
            )
        ).toBeInTheDocument();
        await userEvent.click(
            screen.getByRole("button", { name: "Dismiss notice" })
        );
        expect(
            screen.queryByText(/Prototype for SIH26101/)
        ).not.toBeInTheDocument();
        await router.navigate("/gaps");
        await screen.findByText("Gaps page");
        expect(
            screen.queryByText(/Prototype for SIH26101/)
        ).not.toBeInTheDocument();
    });

    it("passes an axe smoke test", async () => {
        const { container } = renderShell();
        await expectAccessible(container);
    });
});

describe("AppShell role-based sidebar", () => {
    it("shows a learner the learner items and hides admin and trainer items", () => {
        renderShell();
        const nav = within(sidebarNav());
        for (const name of [
            "Dashboard",
            "My competencies",
            "Skill gaps",
            "Virtual labs",
            "AI tutor",
            "Notifications",
            "Settings",
        ])
            expect(nav.getByRole("link", { name })).toBeInTheDocument();
        for (const name of [
            "Users",
            "Audit log",
            "Organisations",
            "Content library",
            "Overview",
        ])
            expect(nav.queryByRole("link", { name })).not.toBeInTheDocument();
    });

    it("shows an admin the administration group only", () => {
        renderShell({ role: "admin" });
        const nav = within(sidebarNav());
        expect(nav.getByRole("link", { name: "Users" })).toHaveAttribute(
            "href",
            "/admin/users"
        );
        expect(
            nav.getByRole("link", { name: "Audit log" })
        ).toBeInTheDocument();
        expect(
            nav.queryByRole("link", { name: "Organisations" })
        ).not.toBeInTheDocument();
        expect(
            nav.queryByRole("link", { name: "My competencies" })
        ).not.toBeInTheDocument();
    });

    it("shows a trainer the teaching group", () => {
        renderShell({ role: "trainer" });
        const nav = within(sidebarNav());
        expect(
            nav.getByRole("link", { name: "Content library" })
        ).toBeInTheDocument();
        expect(
            nav.queryByRole("link", { name: "Users" })
        ).not.toBeInTheDocument();
    });

    it("shows a platform admin everything administrative", () => {
        renderShell({ role: "superadmin" });
        const nav = within(sidebarNav());
        expect(
            nav.getByRole("link", { name: "Organisations" })
        ).toBeInTheDocument();
        expect(nav.getByRole("link", { name: "Users" })).toBeInTheDocument();
    });

    it("labels groups and marks the active item with aria-current", () => {
        renderShell({ route: "/gaps" });
        const nav = within(sidebarNav());
        expect(nav.getByText("Learning")).toBeInTheDocument();
        expect(nav.getByRole("link", { name: "Skill gaps" })).toHaveAttribute(
            "aria-current",
            "page"
        );
        expect(
            nav.getByRole("link", { name: "Dashboard" })
        ).not.toHaveAttribute("aria-current");
    });

    it("keeps a parent item active on its detail pages", () => {
        renderShell({
            route: "/trainer/content/64b7f0c2a1b2c3d4e5f60001",
            role: "trainer",
        });
        expect(
            within(sidebarNav()).getByRole("link", { name: "Content library" })
        ).toHaveAttribute("aria-current", "page");
    });

    it("signs out from the sidebar footer and lands on /login", async () => {
        const { router, store } = renderShell();
        await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
        expect(await screen.findByText("Login page")).toBeInTheDocument();
        expect(router.state.location.pathname).toBe("/login");
        expect(store.getState().auth.user).toBeNull();
    });
});

describe("AppShell collapse", () => {
    beforeEach(() => window.localStorage.clear());
    afterEach(() => window.localStorage.clear());

    const sidebar = () =>
        document.querySelector('[data-slot="sidebar"][data-state]');

    it("starts expanded, toggles from the topbar and stores sai-sidebar", async () => {
        const { store } = renderShell();
        expect(sidebar()).toHaveAttribute("data-state", "expanded");
        await userEvent.click(trigger());
        expect(sidebar()).toHaveAttribute("data-state", "collapsed");
        expect(store.getState().ui.sidebarCollapsed).toBe(true);
        expect(window.localStorage.getItem("sai-sidebar")).toBe("collapsed");
        await userEvent.click(trigger());
        expect(sidebar()).toHaveAttribute("data-state", "expanded");
        expect(window.localStorage.getItem("sai-sidebar")).toBe("expanded");
    });

    it("restores the stored collapsed state", () => {
        window.localStorage.setItem("sai-sidebar", "collapsed");
        renderShell();
        expect(sidebar()).toHaveAttribute("data-state", "collapsed");
    });

    it("toggles with Ctrl+B", async () => {
        renderShell();
        await userEvent.keyboard("{Control>}b{/Control}");
        expect(sidebar()).toHaveAttribute("data-state", "collapsed");
    });

    it("keeps items reachable by name in the collapsed rail and shows a tooltip on hover", async () => {
        window.localStorage.setItem("sai-sidebar", "collapsed");
        renderShell();
        const link = within(sidebarNav()).getByRole("link", {
            name: "Skill gaps",
        });
        await userEvent.hover(link);
        expect(await screen.findByRole("tooltip")).toHaveTextContent(
            "Skill gaps"
        );
    });
});

describe("AppShell topbar", () => {
    it("builds breadcrumbs from the nav config and route title, ending in the current page", () => {
        renderShell({ route: "/admin/users", role: "admin" });
        const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
        const items = within(crumbs).getAllByRole("listitem");
        expect(items.map((item) => item.textContent).filter(Boolean)).toEqual([
            "Dashboard",
            "Overview",
            "Users",
        ]);
        expect(
            within(crumbs).getByRole("link", { name: "Users", current: "page" })
        ).toBeInTheDocument();
        expect(
            within(crumbs).getByRole("link", { name: "Overview" })
        ).toHaveAttribute("href", "/admin");
    });

    it("shows only the current page as a breadcrumb on the dashboard", () => {
        renderShell();
        const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
        expect(within(crumbs).getAllByRole("listitem")).toHaveLength(1);
    });

    it("offers language, theme, notifications and the account menu", () => {
        renderShell();
        const header = within(screen.getByRole("banner"));
        for (const name of [
            "Language",
            "Theme",
            "Notifications",
            "Account menu",
        ])
            expect(header.getByRole("button", { name })).toBeInTheDocument();
    });

    it("renders in Hindi", async () => {
        await i18n.changeLanguage("hi");
        renderShell();
        expect(
            within(
                screen.getByRole("navigation", { name: "ऐप नेविगेशन" })
            ).getByRole("link", {
                name: "मेरी दक्षताएँ",
            })
        ).toBeInTheDocument();
        await i18n.changeLanguage("en");
    });
});

describe("AppShell on a phone", () => {
    beforeEach(() => setViewport(true));
    afterEach(() => setViewport(false));

    it("hides the sidebar until the trigger opens it, then closes it after navigating", async () => {
        const { router } = renderShell();
        expect(
            screen.queryByRole("link", { name: "Skill gaps" })
        ).not.toBeInTheDocument();
        await userEvent.click(trigger());
        const dialog = await screen.findByRole("dialog");
        await userEvent.click(
            within(dialog).getByRole("link", { name: "Skill gaps" })
        );
        expect(router.state.location.pathname).toBe("/gaps");
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("carries language and theme inside the off-canvas sidebar", async () => {
        renderShell();
        await userEvent.click(trigger());
        const dialog = await screen.findByRole("dialog");
        expect(
            within(dialog).getByRole("button", { name: "Language" })
        ).toBeInTheDocument();
        expect(
            within(dialog).getByRole("button", { name: "Theme" })
        ).toBeInTheDocument();
    });
});
