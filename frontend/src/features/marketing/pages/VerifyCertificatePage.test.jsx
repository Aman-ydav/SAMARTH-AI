import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import VerifyCertificatePage from "@/features/marketing/pages/VerifyCertificatePage";
import { i18n } from "@/i18n";
import { expectAccessible } from "@/test/axeCheck";
import { currentLocation, renderPage } from "@/test/pageHarness";

afterEach(async () => {
    await i18n.changeLanguage("en");
});

describe.each(["en", "hi"])("VerifyCertificatePage (%s)", (lng) => {
    beforeEach(async () => {
        await i18n.changeLanguage(lng);
    });
    const t = (key) => i18n.getFixedT(lng, "errors")(key);
    const open = (code) =>
        renderPage(VerifyCertificatePage, {
            path: "/verify/:code",
            entry: `/verify/${code}`,
        });

    it("renders one focused h1 in the main landmark and passes axe", async () => {
        const { container } = open("ABC-123");
        const heading = screen.getByRole("heading", { level: 1 });
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
        expect(heading).toHaveTextContent(t("pages.verifyCertificate.title"));
        expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
        await waitFor(() => expect(heading).toHaveFocus());
        expect(
            screen.getByText(t("pages.verifyCertificate.status"))
        ).toBeInTheDocument();
        await expectAccessible(container);
    });

    it("echoes a well-formed code and drops anything else", () => {
        const { unmount } = open("ABC-123");
        expect(screen.getByText("ABC-123")).toBeInTheDocument();
        unmount();

        open("%3Cscript%3E");
        expect(screen.queryByText(/script/)).not.toBeInTheDocument();
        expect(
            screen.queryByText(t("pages.verifyCertificate.codeLabel"), {
                exact: false,
            })
        ).not.toBeInTheDocument();
    });

    it("links home and to the About page", async () => {
        const { router } = open("ABC-123");
        expect(
            screen.getByRole("link", {
                name: t("pages.verifyCertificate.primary"),
            })
        ).toHaveAttribute("href", "/");
        await userEvent.click(
            screen.getByRole("link", {
                name: t("pages.verifyCertificate.secondary"),
            })
        );
        expect(currentLocation(router)).toBe("/about");
    });
});
