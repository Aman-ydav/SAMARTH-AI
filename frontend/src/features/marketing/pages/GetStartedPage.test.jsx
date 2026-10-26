import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import GetStartedPage from "@/features/marketing/pages/GetStartedPage";
import { i18n } from "@/i18n";
import { anonymousAuth, signedInAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { currentLocation, renderPage } from "@/test/pageHarness";

afterEach(async () => {
    await i18n.changeLanguage("en");
});

describe.each(["en", "hi"])("GetStartedPage (%s)", (lng) => {
    beforeEach(async () => {
        await i18n.changeLanguage(lng);
    });
    const t = (key, options) =>
        i18n.getFixedT(lng, ["auth", "errors", "common", "nav"])(key, options);
    const open = (options) =>
        renderPage(GetStartedPage, {
            path: "/get-started",
            preloadedState: { auth: anonymousAuth },
            ...options,
        });

    it("renders one h1 in the main landmark, three options and passes axe", async () => {
        const { container } = open();
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
            t("auth:start.title")
        );
        expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
        const options = screen.getByRole("region", {
            name: t("errors:pages.getStarted.optionsLabel"),
        });
        expect(
            within(options).getAllByRole("heading", { level: 2 })
        ).toHaveLength(3);
        expect(document.title).toBe(
            `${t("common:pages.getStarted")} | SAMARTH AI`
        );
        await expectAccessible(container);
    });

    it("links Create account to /signup and mentions Google sign-up", async () => {
        const { router } = open();
        expect(
            screen.getByText(t("errors:pages.getStarted.googleHint"))
        ).toBeInTheDocument();
        const create = screen.getByRole("link", {
            name: t("auth:start.learnerAction"),
        });
        expect(create).toHaveAttribute("href", "/signup");
        await userEvent.click(create);
        expect(currentLocation(router)).toBe("/signup");
    });

    it("links Log in to /login", async () => {
        const { router } = open();
        await userEvent.click(
            screen.getByRole("link", { name: t("auth:start.returningAction") })
        );
        expect(currentLocation(router)).toBe("/login");
    });

    it("points the invitation card at the invitation steps on the same page", async () => {
        const { router } = open();
        const link = screen.getByRole("link", {
            name: t("auth:start.inviteAction"),
        });
        expect(link.getAttribute("href")).toMatch(/#invitations$/);
        const section = document.getElementById("invitations");
        expect(section).not.toBeNull();
        expect(within(section).getAllByRole("listitem")).toHaveLength(3);
        await userEvent.click(link);
        expect(router.state.location.hash).toBe("#invitations");
    });

    it("links the Terms, the Privacy Policy and shows the prototype notice", () => {
        open();
        expect(
            screen.getByRole("link", { name: t("common:pages.terms") })
        ).toHaveAttribute("href", "/terms");
        expect(
            screen.getByRole("link", { name: t("common:pages.privacy") })
        ).toHaveAttribute("href", "/privacy");
        expect(
            screen.getByText(t("common:prototypeNotice"))
        ).toBeInTheDocument();
    });

    it("is role aware: a signed-in user is offered the dashboard", async () => {
        const { router } = open({
            preloadedState: { auth: signedInAuth({ role: "learner" }) },
        });
        expect(
            screen.getByText(t("errors:pages.getStarted.signedInTitle"))
        ).toBeInTheDocument();
        await userEvent.click(
            screen.getByRole("link", { name: t("nav:openDashboard") })
        );
        expect(currentLocation(router)).toBe("/dashboard");
    });

    it("does not show the signed-in notice to an anonymous visitor", () => {
        open();
        expect(
            screen.queryByText(t("errors:pages.getStarted.signedInTitle"))
        ).not.toBeInTheDocument();
    });
});
