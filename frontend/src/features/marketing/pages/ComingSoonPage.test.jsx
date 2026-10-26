import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ComingSoonPage from "@/features/marketing/pages/ComingSoonPage";
import { i18n } from "@/i18n";
import { expectAccessible } from "@/test/axeCheck";
import { currentLocation, renderPage } from "@/test/pageHarness";

afterEach(async () => {
    await i18n.changeLanguage("en");
});

describe.each(["en", "hi"])("ComingSoonPage (%s)", (lng) => {
    beforeEach(async () => {
        await i18n.changeLanguage(lng);
    });
    const t = (key, options) =>
        i18n.getFixedT(lng, ["errors", "nav"])(key, options);

    it("renders one focused h1 in the main landmark and passes axe", async () => {
        const { container } = renderPage(ComingSoonPage, {
            path: "/coming-soon",
        });
        const heading = screen.getByRole("heading", { level: 1 });
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
        expect(heading).toHaveTextContent(t("errors:comingSoon.title"));
        expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
        await waitFor(() => expect(heading).toHaveFocus());
        await expectAccessible(container);
    });

    it("uses the generic text on /coming-soon", () => {
        renderPage(ComingSoonPage, {
            path: "/coming-soon",
            handle: { title: "errors:comingSoon.title" },
        });
        expect(
            screen.getByText(t("errors:comingSoon.body"))
        ).toBeInTheDocument();
    });

    it("names the feature from the route handle", () => {
        renderPage(ComingSoonPage, {
            path: "/gaps",
            handle: { title: "nav:sidebar.gaps" },
        });
        expect(
            screen.getByText(
                t("errors:pages.comingSoon.featureLine", {
                    feature: t("nav:sidebar.gaps"),
                })
            )
        ).toBeInTheDocument();
    });

    it("names the feature from navigation state and ignores keys that do not exist", () => {
        const { unmount } = renderPage(ComingSoonPage, {
            path: "/coming-soon",
            state: { feature: "nav:sidebar.labs" },
        });
        expect(
            screen.getByText(
                t("errors:pages.comingSoon.featureLine", {
                    feature: t("nav:sidebar.labs"),
                })
            )
        ).toBeInTheDocument();
        unmount();

        renderPage(ComingSoonPage, {
            path: "/coming-soon",
            state: { feature: "nav:does.not.exist" },
        });
        expect(
            screen.getByText(t("errors:comingSoon.body"))
        ).toBeInTheDocument();
    });

    it("links back to the dashboard and home", async () => {
        const { router } = renderPage(ComingSoonPage, {
            path: "/coming-soon",
        });
        expect(
            screen.getByRole("link", { name: t("errors:comingSoon.primary") })
        ).toHaveAttribute("href", "/dashboard");
        await userEvent.click(
            screen.getByRole("link", { name: t("errors:comingSoon.secondary") })
        );
        expect(currentLocation(router)).toBe("/");
    });
});
