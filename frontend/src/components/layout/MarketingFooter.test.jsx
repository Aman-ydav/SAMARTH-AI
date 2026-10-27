import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketingFooter } from "@/components/layout/MarketingFooter";
import { i18n } from "@/i18n";
import { expectAccessible } from "@/test/axeCheck";
import { renderWithProviders } from "@/test/renderWithProviders";

describe("MarketingFooter", () => {
    afterEach(async () => {
        vi.useRealTimers();
        await i18n.changeLanguage("en");
    });

    it("is the page's contentinfo landmark with the link columns", () => {
        renderWithProviders(<MarketingFooter />);
        const footer = screen.getByRole("contentinfo");
        const nav = within(footer).getByRole("navigation", { name: "Footer" });
        for (const heading of ["Product", "Company", "Legal"])
            expect(
                within(nav).getByRole("heading", { level: 2, name: heading })
            ).toBeInTheDocument();
        expect(
            within(nav).getByRole("link", { name: "About" })
        ).toHaveAttribute("href", "/about");
        expect(
            within(nav).getByRole("link", { name: "Get started" })
        ).toHaveAttribute("href", "/get-started");
        expect(
            within(nav).getByRole("link", { name: "How it works" })
        ).toHaveAttribute("href", "/#how");
    });

    it("marks About as the current page only on /about, with a keyboard-focusable link", async () => {
        const first = renderWithProviders(<MarketingFooter />, {
            route: "/about",
        });
        const nav = screen.getByRole("navigation", { name: "Footer" });
        const about = within(nav).getByRole("link", { name: "About" });
        expect(about).toHaveAttribute("aria-current", "page");
        expect(
            within(nav).getByRole("link", { name: "Get started" })
        ).not.toHaveAttribute("aria-current");
        about.focus();
        expect(about).toHaveFocus();
        first.unmount();
        renderWithProviders(<MarketingFooter />, { route: "/" });
        expect(screen.getByRole("link", { name: "About" })).not.toHaveAttribute(
            "aria-current"
        );
    });

    it("shows About in Hindi in the footer", async () => {
        await i18n.changeLanguage("hi");
        renderWithProviders(<MarketingFooter />);
        expect(
            screen.getByRole("link", { name: "हमारे बारे में" })
        ).toHaveAttribute("href", "/about");
    });

    it("links the legal pages, including the cookie anchor", () => {
        renderWithProviders(<MarketingFooter />);
        expect(
            screen.getByRole("link", { name: "Privacy Policy" })
        ).toHaveAttribute("href", "/privacy");
        expect(
            screen.getByRole("link", { name: "Terms of Use" })
        ).toHaveAttribute("href", "/terms");
        expect(screen.getByRole("link", { name: "Cookies" })).toHaveAttribute(
            "href",
            "/privacy#cookies"
        );
    });

    it("shows the full prototype disclaimer and the demo-data note", () => {
        renderWithProviders(<MarketingFooter />);
        expect(
            screen.getByText(
                /It is not an official Government of India website or service/
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                /not endorsed by or affiliated with MoSPI, NSSTA, iGOT Karmayogi/
            )
        ).toBeInTheDocument();
        expect(screen.getByText("Screens show demo data.")).toBeInTheDocument();
    });

    it("renders the current year through Intl", () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2031-05-05T10:00:00Z"));
        renderWithProviders(<MarketingFooter />);
        expect(screen.getByText("© 2031 SAMARTH AI team")).toBeInTheDocument();
    });

    it("offers language and theme controls", () => {
        renderWithProviders(<MarketingFooter />);
        expect(
            screen.getByRole("button", { name: "Language" })
        ).toHaveTextContent("English");
        expect(
            screen.getByRole("button", { name: "Theme" })
        ).toBeInTheDocument();
    });

    it("is translated into Hindi and keeps Latin digits for the year", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2031-05-05T10:00:00Z"));
        await i18n.changeLanguage("hi");
        renderWithProviders(<MarketingFooter />);
        expect(
            screen.getByRole("navigation", { name: "फ़ुटर" })
        ).toBeInTheDocument();
        expect(screen.getByText("© 2031 SAMARTH AI टीम")).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "गोपनीयता नीति" })
        ).toBeInTheDocument();
    });

    it("passes an axe smoke test", async () => {
        const { container } = renderWithProviders(<MarketingFooter />);
        await expectAccessible(container);
    });
});
