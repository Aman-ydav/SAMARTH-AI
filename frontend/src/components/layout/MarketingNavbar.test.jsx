import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { MarketingNavbar } from "@/components/layout/MarketingNavbar";
import { i18n } from "@/i18n";
import { anonymousAuth, signedInAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { renderRoutes } from "@/test/renderWithProviders";

function renderNavbar({ route = "/", auth = anonymousAuth } = {}) {
    return renderRoutes([{ path: "*", element: <MarketingNavbar /> }], {
        route,
        preloadedState: { auth },
    });
}

function scrollTo(y) {
    act(() => {
        Object.defineProperty(window, "scrollY", {
            value: y,
            configurable: true,
        });
        fireEvent.scroll(window);
    });
}

describe("MarketingNavbar", () => {
    afterEach(async () => {
        scrollTo(0);
        window.localStorage.clear();
        await i18n.changeLanguage("en");
    });

    it("shows the logo link, the five public links and the anonymous CTAs", () => {
        renderNavbar();
        expect(
            screen.getByRole("link", { name: "SAMARTH AI" })
        ).toHaveAttribute("href", "/");
        const nav = screen.getByRole("navigation", { name: "Main navigation" });
        const labels = within(nav)
            .getAllByRole("link")
            .map((link) => link.textContent);
        expect(labels).toEqual([
            "How it works",
            "Features",
            "Security",
            "About",
            "FAQ",
        ]);
        expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
            "href",
            "/login"
        );
        expect(
            screen.getByRole("link", { name: "Get started" })
        ).toHaveAttribute("href", "/get-started");
        expect(
            screen.queryByRole("link", { name: "Open dashboard" })
        ).not.toBeInTheDocument();
    });

    it("points anchor links at the landing sections", () => {
        renderNavbar({ route: "/about" });
        const nav = screen.getByRole("navigation", { name: "Main navigation" });
        expect(
            within(nav).getByRole("link", { name: "How it works" })
        ).toHaveAttribute("href", "/#how");
        expect(within(nav).getByRole("link", { name: "FAQ" })).toHaveAttribute(
            "href",
            "/#faq"
        );
    });

    it("marks only the current page link with aria-current", () => {
        renderNavbar({ route: "/about" });
        const nav = screen.getByRole("navigation", { name: "Main navigation" });
        expect(
            within(nav).getByRole("link", { name: "About" })
        ).toHaveAttribute("aria-current", "page");
        expect(
            within(nav).getByRole("link", { name: "FAQ" })
        ).not.toHaveAttribute("aria-current");
    });

    it("swaps the CTAs for Dashboard and the avatar menu when signed in", () => {
        renderNavbar({ auth: signedInAuth() });
        expect(
            screen.getByRole("link", { name: "Open dashboard" })
        ).toHaveAttribute("href", "/dashboard");
        expect(
            screen.getByRole("button", { name: "Account menu" })
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("link", { name: "Log in" })
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole("link", { name: "Get started" })
        ).not.toBeInTheDocument();
    });

    it("only gains a bottom border after scrolling past the threshold, nothing else", () => {
        renderNavbar();
        const header = screen.getByRole("banner");
        expect(header).toHaveAttribute("data-scrolled", "false");
        expect(header).toHaveClass("border-transparent");
        const before = header.className.replace(
            /border-transparent|border-border/,
            ""
        );

        scrollTo(40);
        expect(header).toHaveAttribute("data-scrolled", "true");
        expect(header).toHaveClass("border-border");
        expect(
            header.className.replace(/border-transparent|border-border/, "")
        ).toBe(before);
        expect(header.className).not.toMatch(/blur|shadow|backdrop/);

        scrollTo(0);
        expect(header).toHaveClass("border-transparent");
    });

    it("keeps language and theme controls in the bar", () => {
        renderNavbar();
        expect(
            screen.getByRole("button", { name: "Language" })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Theme" })
        ).toBeInTheDocument();
    });

    it("switches the labels to Hindi from the language menu", async () => {
        renderNavbar();
        await userEvent.click(screen.getByRole("button", { name: "Language" }));
        await userEvent.click(
            screen.getByRole("menuitemradio", { name: "हिन्दी" })
        );
        expect(
            await screen.findByRole("link", { name: "लॉग इन" })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "यह कैसे काम करता है" })
        ).toBeInTheDocument();
    });

    it("passes an axe smoke test anonymous and signed in", async () => {
        const first = renderNavbar();
        await expectAccessible(first.container);
        first.unmount();
        const second = renderNavbar({ auth: signedInAuth() });
        await expectAccessible(second.container);
    });
});

describe("MarketingNavbar mobile menu", () => {
    const openMenu = () =>
        userEvent.click(screen.getByRole("button", { name: "Open menu" }));

    it("opens a dialog with stacked links, language, theme and full-width CTAs", async () => {
        renderNavbar();
        await openMenu();
        const dialog = await screen.findByRole("dialog", { name: "Menu" });
        const nav = within(dialog).getByRole("navigation", {
            name: "Mobile navigation",
        });
        expect(within(nav).getAllByRole("link")).toHaveLength(6);
        expect(
            within(nav).getByRole("link", { name: "Home" })
        ).toBeInTheDocument();
        expect(
            within(dialog).getByRole("button", { name: "Language" })
        ).toBeInTheDocument();
        expect(
            within(dialog).getByRole("button", { name: "Theme" })
        ).toBeInTheDocument();
        expect(
            within(dialog).getByRole("link", { name: "Log in" })
        ).toBeInTheDocument();
        expect(
            within(dialog).getByRole("link", { name: "Get started" })
        ).toBeInTheDocument();
    });

    it("moves focus into the dialog, keeps it there, and closes with Escape", async () => {
        renderNavbar();
        const trigger = screen.getByRole("button", { name: "Open menu" });
        await userEvent.click(trigger);
        const dialog = await screen.findByRole("dialog", { name: "Menu" });
        expect(dialog.contains(document.activeElement)).toBe(true);
        await userEvent.tab();
        await userEvent.tab();
        expect(dialog.contains(document.activeElement)).toBe(true);
        await userEvent.keyboard("{Escape}");
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });

    it("closes after following a link", async () => {
        const { router } = renderNavbar();
        await openMenu();
        const dialog = await screen.findByRole("dialog", { name: "Menu" });
        await userEvent.click(
            within(dialog).getByRole("link", { name: "About" })
        );
        expect(router.state.location.pathname).toBe("/about");
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("shows the account actions instead of the CTAs when signed in", async () => {
        renderNavbar({ auth: signedInAuth() });
        await openMenu();
        const dialog = await screen.findByRole("dialog", { name: "Menu" });
        expect(
            within(dialog).getByRole("link", { name: "Open dashboard" })
        ).toBeInTheDocument();
        expect(
            within(dialog).getByRole("button", { name: "Log out" })
        ).toBeEnabled();
        expect(
            within(dialog).queryByRole("link", { name: "Get started" })
        ).not.toBeInTheDocument();
    });

    it("passes an axe smoke test with the menu open", async () => {
        renderNavbar();
        await openMenu();
        await screen.findByRole("dialog", { name: "Menu" });
        await expectAccessible(document.body);
    });
});
