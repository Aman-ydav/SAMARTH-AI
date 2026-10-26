import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ServerErrorPage from "@/features/marketing/pages/ServerErrorPage";
import { i18n } from "@/i18n";
import { expectAccessible } from "@/test/axeCheck";
import { currentLocation, renderPage } from "@/test/pageHarness";

afterEach(async () => {
    await i18n.changeLanguage("en");
});

describe.each(["en", "hi"])("ServerErrorPage (%s)", (lng) => {
    beforeEach(async () => {
        await i18n.changeLanguage(lng);
    });
    const t = (key, options) => i18n.getFixedT(lng, "errors")(key, options);

    it("renders one focused h1 in the main landmark and passes axe", async () => {
        const { container } = renderPage(ServerErrorPage);
        const heading = screen.getByRole("heading", { level: 1 });
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
        expect(heading).toHaveTextContent(t("serverError.title"));
        expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
        await waitFor(() => expect(heading).toHaveFocus());
        await expectAccessible(container);
    });

    it("shows no request id unless one is supplied", () => {
        renderPage(ServerErrorPage);
        expect(screen.queryByText(/req-/)).not.toBeInTheDocument();
    });

    it("shows the request id from the navigation state", () => {
        renderPage(ServerErrorPage, { state: { requestId: "req-abc-123" } });
        expect(
            screen.getByText(t("requestId", { id: "req-abc-123" }))
        ).toBeInTheDocument();
    });

    it("shows the request id from an error prop and never the error message", () => {
        const error = new Error("secret stack trace SELECT * FROM users");
        error.requestId = "req-prop-9";
        render(
            <I18nextProvider i18n={i18n}>
                <MemoryRouter>
                    <ServerErrorPage error={error} />
                </MemoryRouter>
            </I18nextProvider>
        );
        expect(
            screen.getByText(t("requestId", { id: "req-prop-9" }))
        ).toBeInTheDocument();
        expect(
            screen.queryByText(/secret stack trace/)
        ).not.toBeInTheDocument();
    });

    it("ignores a request id that is not id-shaped (no markup or text injection)", () => {
        renderPage(ServerErrorPage, {
            state: { requestId: "<img src=x onerror=alert(1)>" },
        });
        expect(document.querySelector("img")).toBeNull();
        expect(screen.queryByText(/onerror/)).not.toBeInTheDocument();
    });

    it("Try again goes back when there is history, otherwise to home", async () => {
        const { router } = renderPage(ServerErrorPage, {
            history: ["/before"],
        });
        await userEvent.click(
            screen.getByRole("button", { name: t("serverError.primary") })
        );
        await waitFor(() => expect(currentLocation(router)).toBe("/before"));
    });

    it("Try again goes home on the first history entry; the secondary link goes home", async () => {
        const { router, unmount } = renderPage(ServerErrorPage);
        await userEvent.click(
            screen.getByRole("button", { name: t("serverError.primary") })
        );
        await waitFor(() => expect(currentLocation(router)).toBe("/"));
        unmount();

        const second = renderPage(ServerErrorPage);
        await userEvent.click(
            screen.getByRole("link", { name: t("serverError.secondary") })
        );
        expect(currentLocation(second.router)).toBe("/");
    });
});
