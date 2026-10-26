import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CookiesDisabledPage from "@/features/marketing/pages/CookiesDisabledPage";
import { i18n } from "@/i18n";
import { expectAccessible } from "@/test/axeCheck";
import { currentLocation, renderPage } from "@/test/pageHarness";

function setCookieEnabled(value) {
    vi.spyOn(window.navigator, "cookieEnabled", "get").mockReturnValue(value);
}

afterEach(async () => {
    vi.unstubAllGlobals();
    await i18n.changeLanguage("en");
});

describe.each(["en", "hi"])("CookiesDisabledPage (%s)", (lng) => {
    beforeEach(async () => {
        await i18n.changeLanguage(lng);
    });
    const t = (key) => i18n.getFixedT(lng, "errors")(key);

    describe("cookies are off", () => {
        beforeEach(() => setCookieEnabled(false));

        it("renders one focused h1 in the main landmark and passes axe", async () => {
            const { container } = renderPage(CookiesDisabledPage);
            const heading = screen.getByRole("heading", { level: 1 });
            expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(
                1
            );
            expect(heading).toHaveTextContent(t("cookiesDisabled.title"));
            expect(screen.getByRole("main")).toHaveAttribute(
                "id",
                "main-content"
            );
            await waitFor(() => expect(heading).toHaveFocus());
            await expectAccessible(container);
        });

        it("explains the problem, lists the steps and links to the cookie details", async () => {
            const { router } = renderPage(CookiesDisabledPage);
            expect(
                screen.getByText(t("cookiesDisabled.body"))
            ).toBeInTheDocument();
            expect(
                screen.getByRole("heading", {
                    level: 2,
                    name: t("pages.cookiesDisabled.stepsTitle"),
                })
            ).toBeInTheDocument();
            expect(screen.getAllByRole("listitem")).toHaveLength(3);
            const details = screen.getByRole("link", {
                name: t("cookiesDisabled.secondary"),
            });
            expect(details).toHaveAttribute("href", "/privacy#cookies");
            await userEvent.click(details);
            expect(currentLocation(router)).toBe("/privacy#cookies");
        });

        it("Reload page reloads while cookies are still off", async () => {
            const reload = vi.fn();
            vi.stubGlobal("location", { ...window.location, reload });
            renderPage(CookiesDisabledPage);
            await userEvent.click(
                screen.getByRole("button", {
                    name: t("cookiesDisabled.primary"),
                })
            );
            expect(reload).toHaveBeenCalledTimes(1);
        });

        it("switches to the enabled view without reloading when the setting was fixed", async () => {
            const reload = vi.fn();
            vi.stubGlobal("location", { ...window.location, reload });
            renderPage(CookiesDisabledPage);
            setCookieEnabled(true);
            await userEvent.click(
                screen.getByRole("button", {
                    name: t("cookiesDisabled.primary"),
                })
            );
            expect(
                await screen.findByText(t("pages.cookiesDisabled.enabledNow"))
            ).toBeInTheDocument();
            expect(reload).not.toHaveBeenCalled();
        });
    });

    describe("cookies are on", () => {
        beforeEach(() => setCookieEnabled(true));

        it("says so and offers the sign-in link instead of the steps", async () => {
            const { router, container } = renderPage(CookiesDisabledPage);
            expect(
                screen.getByText(t("pages.cookiesDisabled.enabledNow"))
            ).toBeInTheDocument();
            expect(
                screen.queryByText(t("pages.cookiesDisabled.stepsTitle"))
            ).not.toBeInTheDocument();
            await expectAccessible(container);
            await userEvent.click(
                screen.getByRole("link", {
                    name: t("pages.cookiesDisabled.enabledAction"),
                })
            );
            expect(currentLocation(router)).toBe("/login");
        });
    });
});
