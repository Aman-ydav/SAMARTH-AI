import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TermsPage from "@/features/marketing/pages/TermsPage";
import {
    LEGAL_PLACEHOLDERS,
    LEGAL_VERSION,
    TERMS_SECTIONS,
} from "@/features/marketing/data/legalMeta";
import { i18n } from "@/i18n";
import { expectAccessible } from "@/test/axeCheck";
import { renderPage } from "@/test/pageHarness";

// Long documents and lazily loaded sections are slow under a loaded machine (axe walks the whole page).
vi.setConfig({ testTimeout: 20_000 });

afterEach(async () => {
    await i18n.changeLanguage("en");
});

describe.each(["en", "hi"])("TermsPage (%s)", (lng) => {
    beforeEach(async () => {
        await i18n.changeLanguage(lng);
    });
    const t = (key, options) => i18n.getFixedT(lng, "legal")(key, options);
    const open = (entry = "/terms") =>
        renderPage(TermsPage, { path: "/terms", entry });

    it("renders one h1 in the main landmark, the draft notice and version, and passes axe", async () => {
        const { container } = open();
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
            t("terms.title")
        );
        expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
        expect(screen.getByText(t("common.draftNotice"))).toBeInTheDocument();
        expect(screen.getByText(LEGAL_VERSION)).toBeInTheDocument();
        expect(document.title).toBe(`${t("terms.title")} | SAMARTH AI`);
        await expectAccessible(container);
    });

    it("has a table of contents whose links all resolve, with the stable ids", () => {
        const { container } = open();
        const toc = screen.getByRole("navigation", {
            name: t("common.tocTitle"),
        });
        const links = within(toc).getAllByRole("link");
        expect(links).toHaveLength(TERMS_SECTIONS.length);
        for (const link of links) {
            const id = link.getAttribute("href").split("#")[1];
            expect(
                container.querySelector(`h2#${CSS.escape(id)}`),
                `anchor #${id}`
            ).not.toBeNull();
        }
        expect(
            links.map((link) => link.getAttribute("href").split("#")[1])
        ).toEqual([
            "acceptance",
            "prototype",
            "accounts",
            "acceptable-use",
            "your-content",
            "ai-output",
            "third-party",
            "ip",
            "availability",
            "liability",
            "termination",
            "governing-law",
            "changes",
        ]);
    });

    it("flags the contact, licence and jurisdiction placeholders and leaves no raw markers", () => {
        const { container } = open();
        expect(container).toHaveTextContent(LEGAL_PLACEHOLDERS.supportEmail);
        expect(container).toHaveTextContent(LEGAL_PLACEHOLDERS.licence);
        expect(container).toHaveTextContent(
            LEGAL_PLACEHOLDERS.jurisdictionCity
        );
        expect(container).not.toHaveTextContent("{{");
    });

    it("states the prototype status and links to the Privacy Policy", async () => {
        const { router } = open();
        expect(screen.getByText(t("common.disclaimer"))).toBeInTheDocument();
        await userEvent.click(
            screen.getByRole("link", { name: t("terms.relatedLink") })
        );
        expect(router.state.location.pathname).toBe("/privacy");
    });
});
