import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MaintenancePage from "@/features/marketing/pages/MaintenancePage";
import { i18n } from "@/i18n";
import { expectAccessible } from "@/test/axeCheck";
import { currentLocation, renderPage } from "@/test/pageHarness";

afterEach(async () => {
    vi.useRealTimers();
    await i18n.changeLanguage("en");
});

describe.each(["en", "hi"])("MaintenancePage (%s)", (lng) => {
    beforeEach(async () => {
        await i18n.changeLanguage(lng);
    });
    const t = (key, options) => i18n.getFixedT(lng, "errors")(key, options);

    it("renders one focused h1 in the main landmark and passes axe", async () => {
        const { container } = renderPage(MaintenancePage);
        const heading = screen.getByRole("heading", { level: 1 });
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
        expect(heading).toHaveTextContent(t("maintenance.title"));
        expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
        await waitFor(() => expect(heading).toHaveFocus());
        await expectAccessible(container);
    });

    it("shows the 30 second countdown and the expected return time", async () => {
        renderPage(MaintenancePage, {
            state: { until: "2026-10-27T09:30:00.000Z" },
        });
        expect(
            await screen.findByText(
                t("pages.maintenance.autoRetry", { seconds: 30 })
            )
        ).toBeInTheDocument();
        expect(screen.getByText(/2026/, { selector: "p" })).toHaveTextContent(
            /27/
        );
    });

    it("Check again returns to the validated origin immediately", async () => {
        const { router } = renderPage(MaintenancePage, {
            state: { from: "/dashboard" },
        });
        await userEvent.click(
            screen.getByRole("button", { name: t("maintenance.primary") })
        );
        await waitFor(() => expect(currentLocation(router)).toBe("/dashboard"));
    });

    it("ignores an unsafe origin and goes home", async () => {
        const { router } = renderPage(MaintenancePage, {
            state: { from: "//evil.example" },
        });
        await userEvent.click(
            screen.getByRole("button", { name: t("maintenance.primary") })
        );
        await waitFor(() => expect(currentLocation(router)).toBe("/"));
    });

    it("links home as the secondary action", async () => {
        const { router } = renderPage(MaintenancePage);
        await userEvent.click(
            screen.getByRole("link", { name: t("maintenance.secondary") })
        );
        expect(currentLocation(router)).toBe("/");
    });
});

describe("MaintenancePage auto retry", () => {
    it("checks again by itself after 30 seconds", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: false });
        const { router } = renderPage(MaintenancePage, {
            state: { from: "/dashboard" },
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(currentLocation(router)).toBe("/page");
        await act(async () => {
            await vi.advanceTimersByTimeAsync(30_000);
        });
        expect(currentLocation(router)).toBe("/dashboard");
    });
});
