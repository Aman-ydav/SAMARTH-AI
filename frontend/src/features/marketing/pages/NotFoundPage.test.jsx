import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import NotFoundPage from "@/features/marketing/pages/NotFoundPage";
import { i18n } from "@/i18n";
import { expectAccessible } from "@/test/axeCheck";
import { currentLocation, renderPage } from "@/test/pageHarness";

afterEach(async () => {
    await i18n.changeLanguage("en");
});

describe.each(["en", "hi"])("NotFoundPage (%s)", (lng) => {
    beforeEach(async () => {
        await i18n.changeLanguage(lng);
    });
    const t = (key) => i18n.getFixedT(lng, "errors")(key);

    it("renders one h1 inside the main landmark, focused, with the page title", async () => {
        const { container } = renderPage(NotFoundPage);
        const heading = screen.getByRole("heading", { level: 1 });
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
        expect(heading).toHaveTextContent(t("notFound.title"));
        expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
        await waitFor(() => expect(heading).toHaveFocus());
        expect(document.title).toBe(`${t("notFound.title")} | SAMARTH AI`);
        await expectAccessible(container);
    });

    it("links home as the primary action", async () => {
        const { router } = renderPage(NotFoundPage);
        const home = screen.getByRole("link", { name: t("notFound.primary") });
        expect(home).toHaveAttribute("href", "/");
        await userEvent.click(home);
        expect(currentLocation(router)).toBe("/");
    });

    it("offers Go back only when the app has earlier history, and goes back", async () => {
        const first = renderPage(NotFoundPage);
        expect(
            screen.queryByRole("button", { name: t("notFound.secondary") })
        ).not.toBeInTheDocument();
        first.unmount();

        const { router } = renderPage(NotFoundPage, { history: ["/before"] });
        await userEvent.click(
            screen.getByRole("button", { name: t("notFound.secondary") })
        );
        await waitFor(() => expect(currentLocation(router)).toBe("/before"));
    });
});
