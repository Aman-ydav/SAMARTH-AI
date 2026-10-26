import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import UnauthorizedPage from "@/features/marketing/pages/UnauthorizedPage";
import { i18n } from "@/i18n";
import { errorResponse, apiUrl } from "@/mocks/fixtures/envelope";
import { anonymousAuth, signedInAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { currentLocation, renderPage } from "@/test/pageHarness";

const server = setupMockServer();

afterEach(async () => {
    await i18n.changeLanguage("en");
});

describe.each(["en", "hi"])("UnauthorizedPage (%s)", (lng) => {
    beforeEach(async () => {
        await i18n.changeLanguage(lng);
    });
    const t = (key) => i18n.getFixedT(lng, "errors")(key);

    it("renders one focused h1 in the main landmark and passes axe", async () => {
        const { container } = renderPage(UnauthorizedPage, {
            preloadedState: { auth: anonymousAuth },
        });
        const heading = screen.getByRole("heading", { level: 1 });
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
        expect(heading).toHaveTextContent(t("unauthorized.title"));
        expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
        await waitFor(() => expect(heading).toHaveFocus());
        expect(document.title).toBe(`${t("unauthorized.title")} | SAMARTH AI`);
        await expectAccessible(container);
    });

    it("sends an anonymous visitor to the dashboard link or the login page", async () => {
        const { router } = renderPage(UnauthorizedPage, {
            preloadedState: { auth: anonymousAuth },
        });
        expect(
            screen.getByRole("link", { name: t("unauthorized.primary") })
        ).toHaveAttribute("href", "/dashboard");
        await userEvent.click(
            screen.getByRole("link", { name: t("unauthorized.secondary") })
        );
        expect(currentLocation(router)).toBe("/login");
    });

    it("ends the session first for a signed-in user, then opens the login page", async () => {
        const { router } = renderPage(UnauthorizedPage, {
            preloadedState: { auth: signedInAuth({ role: "learner" }) },
        });
        expect(
            screen.queryByRole("link", { name: t("unauthorized.secondary") })
        ).not.toBeInTheDocument();
        await userEvent.click(
            screen.getByRole("button", { name: t("unauthorized.secondary") })
        );
        await waitFor(() => expect(currentLocation(router)).toBe("/login"));
    });
});

describe("UnauthorizedPage logout failure", () => {
    it("stays on the page and says so when the server cannot end the session", async () => {
        server.use(
            http.post(apiUrl("/auth/logout"), () =>
                errorResponse(500, "INTERNAL")
            )
        );
        const { router } = renderPage(UnauthorizedPage, {
            preloadedState: { auth: signedInAuth({ role: "learner" }) },
        });
        await userEvent.click(
            screen.getByRole("button", {
                name: i18n.t("unauthorized.secondary", { ns: "errors" }),
            })
        );
        expect(await screen.findByRole("alert")).toHaveTextContent(
            i18n.t("codes.NETWORK_ERROR", { ns: "errors" })
        );
        expect(currentLocation(router)).toBe("/page");
    });
});
