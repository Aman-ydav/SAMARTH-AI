import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PrivacyPage from "@/features/marketing/pages/PrivacyPage";
import {
    LEGAL_LAST_UPDATED,
    LEGAL_PLACEHOLDERS,
    LEGAL_VERSION,
    PRIVACY_SECTIONS,
} from "@/features/marketing/data/legalMeta";
import { i18n } from "@/i18n";
import { expectAccessible } from "@/test/axeCheck";
import { renderPage } from "@/test/pageHarness";

// Long documents and lazily loaded sections are slow under a loaded machine (axe walks the whole page).
vi.setConfig({ testTimeout: 20_000 });

afterEach(async () => {
    await i18n.changeLanguage("en");
});

describe.each(["en", "hi"])("PrivacyPage (%s)", (lng) => {
    beforeEach(async () => {
        await i18n.changeLanguage(lng);
    });
    const t = (key, options) => i18n.getFixedT(lng, "legal")(key, options);
    const open = (entry = "/privacy") =>
        renderPage(PrivacyPage, { path: "/privacy", entry });

    it("renders one h1 in the main landmark, the draft notice, version and date, and passes axe", async () => {
        const { container } = open();
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
            t("privacy.title")
        );
        expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
        expect(screen.getAllByRole("note")).toHaveLength(2);
        expect(screen.getByText(t("common.draftNotice"))).toBeInTheDocument();
        expect(screen.getByText(LEGAL_VERSION)).toBeInTheDocument();
        expect(
            container.querySelector(`time[datetime="${LEGAL_LAST_UPDATED}"]`)
        ).not.toBeNull();
        expect(document.title).toBe(`${t("privacy.title")} | SAMARTH AI`);
        await expectAccessible(container);
    });

    it("lists every section in the table of contents and each link resolves to an existing id", async () => {
        const { container } = open();
        const toc = screen.getByRole("navigation", {
            name: t("common.tocTitle"),
        });
        const links = within(toc).getAllByRole("link");
        expect(links).toHaveLength(PRIVACY_SECTIONS.length);
        for (const link of links) {
            const id = link.getAttribute("href").split("#")[1];
            const target = container.querySelector(`#${CSS.escape(id)}`);
            expect(target, `anchor #${id}`).not.toBeNull();
            expect(target.tagName).toBe("H2");
        }
        expect(
            links.map((link) => link.getAttribute("href").split("#")[1])
        ).toEqual(PRIVACY_SECTIONS.map((section) => section.id));
    });

    it("keeps the stable anchor ids from the content plan", () => {
        const { container } = open();
        for (const id of [
            "overview",
            "who-we-are",
            "data-we-collect",
            "purposes-and-consent",
            "cookies",
            "processors",
            "ai",
            "retention",
            "security",
            "your-rights",
            "grievance",
            "children",
            "transfers",
            "changes",
        ]) {
            expect(container.querySelector(`h2#${id}`), id).not.toBeNull();
        }
    });

    it("flags contact details as placeholders and leaves no raw interpolation markers", () => {
        const { container } = open();
        expect(container).toHaveTextContent(LEGAL_PLACEHOLDERS.supportEmail);
        expect(container).toHaveTextContent(LEGAL_PLACEHOLDERS.grievanceEmail);
        expect(container).toHaveTextContent(LEGAL_PLACEHOLDERS.llmProvider);
        expect(container).not.toHaveTextContent("{{");
        expect(
            screen.getByText(t("common.placeholderNote"))
        ).toBeInTheDocument();
    });

    it("renders the cookie table with the cookies of rule 04", () => {
        open();
        const table = screen.getByRole("table");
        const rows = within(table).getAllByRole("row");
        expect(rows).toHaveLength(7);
        for (const name of [
            "sai_access",
            "sai_refresh",
            "sai_csrf",
            "sai-theme",
            "sai-lang",
            "sai-sidebar",
        ]) {
            expect(within(table).getByText(name)).toBeInTheDocument();
        }
        expect(within(table).getAllByRole("columnheader")).toHaveLength(4);
    });

    it("scrolls to a deep-linked section such as #cookies", () => {
        const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
        open("/privacy#cookies");
        expect(scroll).toHaveBeenCalled();
        expect(scroll.mock.contexts.at(-1).id).toBe("cookies");
    });

    it("ignores an unknown hash", () => {
        const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
        open("/privacy#does-not-exist");
        expect(scroll).not.toHaveBeenCalled();
    });

    it("prints on request and links to the Terms", async () => {
        const print = vi.spyOn(window, "print").mockImplementation(() => {});
        const { router } = open();
        await userEvent.click(
            screen.getByRole("button", { name: t("common.print") })
        );
        expect(print).toHaveBeenCalledTimes(1);
        await userEvent.click(
            screen.getByRole("link", { name: t("privacy.relatedLink") })
        );
        expect(router.state.location.pathname).toBe("/terms");
    });

    it("shows the full prototype disclaimer", () => {
        open();
        expect(screen.getByText(t("common.disclaimer"))).toBeInTheDocument();
    });
});

describe("PrivacyPage Hindi fallback", () => {
    beforeEach(async () => {
        await i18n.changeLanguage("hi");
    });

    it("says the English text is authoritative and marks untranslated blocks lang=en", () => {
        const { container } = renderPage(PrivacyPage, { path: "/privacy" });
        expect(
            screen.getByText(
                i18n.t("common.englishAuthoritative", {
                    ns: "legal",
                    lng: "hi",
                })
            )
        ).toBeInTheDocument();

        // Translated: the summary has Hindi paragraphs and no lang override.
        const overview = container.querySelector(
            "section[aria-labelledby=overview]"
        );
        expect(overview.querySelector("p").getAttribute("lang")).toBeNull();

        // Not translated: the list of collected data falls back to English and is marked.
        const collected = container.querySelector(
            "section[aria-labelledby=data-we-collect]"
        );
        expect(collected.querySelector("ul")).toHaveAttribute("lang", "en");
        expect(collected.querySelector("h2")).not.toHaveAttribute("lang");
    });

    it("does not show the English-only notice in English", async () => {
        await i18n.changeLanguage("en");
        renderPage(PrivacyPage, { path: "/privacy" });
        expect(
            screen.queryByText(
                i18n.t("common.englishAuthoritative", {
                    ns: "legal",
                    lng: "en",
                })
            )
        ).not.toBeInTheDocument();
    });
});
