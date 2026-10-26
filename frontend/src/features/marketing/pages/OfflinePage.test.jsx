import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OfflinePage from "@/features/marketing/pages/OfflinePage";
import { i18n } from "@/i18n";
import { expectAccessible } from "@/test/axeCheck";
import { currentLocation, renderPage } from "@/test/pageHarness";

function setOnline(value) {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(value);
}

function fireConnection(type) {
    act(() => {
        window.dispatchEvent(new Event(type));
    });
}

afterEach(async () => {
    await i18n.changeLanguage("en");
});

describe.each(["en", "hi"])("OfflinePage (%s)", (lng) => {
    beforeEach(async () => {
        await i18n.changeLanguage(lng);
        setOnline(false);
    });
    const t = (key) => i18n.getFixedT(lng, "errors")(key);

    it("renders one focused h1 in the main landmark and passes axe", async () => {
        const { container } = renderPage(OfflinePage);
        const heading = screen.getByRole("heading", { level: 1 });
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
        expect(heading).toHaveTextContent(t("offline.title"));
        expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
        await waitFor(() => expect(heading).toHaveFocus());
        await expectAccessible(container);
    });

    it("Retry while still offline stays put and says the connection is down", async () => {
        const { router } = renderPage(OfflinePage);
        await userEvent.click(
            screen.getByRole("button", { name: t("offline.primary") })
        );
        expect(await screen.findByRole("status")).toHaveTextContent(
            t("pages.offline.stillOffline")
        );
        expect(currentLocation(router)).toBe("/page");
    });

    it("returns to where the user came from when the connection comes back", async () => {
        const { router } = renderPage(OfflinePage, {
            state: { from: "/dashboard" },
        });
        setOnline(true);
        fireConnection("online");
        await waitFor(() => expect(currentLocation(router)).toBe("/dashboard"));
    });

    it("Retry works once the browser reports online", async () => {
        const { router } = renderPage(OfflinePage);
        await userEvent.click(
            screen.getByRole("button", { name: t("offline.primary") })
        );
        setOnline(true);
        fireConnection("online");
        await waitFor(() => expect(currentLocation(router)).toBe("/"));
    });
});

describe("OfflinePage opened while online", () => {
    it("does not redirect by itself; Retry leaves to the safe origin", async () => {
        setOnline(true);
        const { router } = renderPage(OfflinePage, {
            state: { from: "/about" },
        });
        expect(screen.getByRole("status")).toHaveTextContent(
            i18n.t("pages.offline.backOnline", { ns: "errors" })
        );
        expect(currentLocation(router)).toBe("/page");
        await userEvent.click(
            screen.getByRole("button", {
                name: i18n.t("offline.primary", { ns: "errors" }),
            })
        );
        await waitFor(() => expect(currentLocation(router)).toBe("/about"));
    });
});
