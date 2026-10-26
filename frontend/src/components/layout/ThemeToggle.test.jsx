import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { i18n } from "@/i18n";
import { expectAccessible } from "@/test/axeCheck";
import { renderWithProviders } from "@/test/renderWithProviders";

const openMenu = async () => {
    await userEvent.click(screen.getByRole("button", { name: "Theme" }));
};

describe("ThemeToggle", () => {
    beforeEach(() => window.localStorage.clear());
    afterEach(async () => {
        window.localStorage.clear();
        await i18n.changeLanguage("en");
    });

    it("offers light, dark and system and marks the current choice", async () => {
        renderWithProviders(<ThemeToggle />);
        await openMenu();
        expect(
            screen.getByRole("menuitemradio", { name: "System" })
        ).toBeChecked();
        expect(
            screen.getByRole("menuitemradio", { name: "Light" })
        ).not.toBeChecked();
        expect(
            screen.getByRole("menuitemradio", { name: "Dark" })
        ).not.toBeChecked();
    });

    it("changes the preference and persists it as sai-theme", async () => {
        const { store } = renderWithProviders(<ThemeToggle />);
        await openMenu();
        await userEvent.click(
            screen.getByRole("menuitemradio", { name: "Dark" })
        );
        expect(store.getState().ui.theme).toBe("dark");
        expect(window.localStorage.getItem("sai-theme")).toBe("dark");
        await openMenu();
        expect(
            screen.getByRole("menuitemradio", { name: "Dark" })
        ).toBeChecked();
    });

    it("reflects a stored preference on first render", async () => {
        window.localStorage.setItem("sai-theme", "light");
        renderWithProviders(<ThemeToggle />);
        await openMenu();
        expect(
            screen.getByRole("menuitemradio", { name: "Light" })
        ).toBeChecked();
    });

    it("is operable by keyboard", async () => {
        const { store } = renderWithProviders(<ThemeToggle />);
        await userEvent.tab();
        expect(screen.getByRole("button", { name: "Theme" })).toHaveFocus();
        await userEvent.keyboard("{Enter}");
        await userEvent.keyboard("{ArrowDown}{Enter}");
        expect(store.getState().ui.theme).toBe("dark");
    });

    it("is translated into Hindi", async () => {
        await i18n.changeLanguage("hi");
        renderWithProviders(<ThemeToggle />);
        await userEvent.click(screen.getByRole("button", { name: "थीम" }));
        expect(
            screen.getByRole("menuitemradio", { name: "डार्क" })
        ).toBeInTheDocument();
    });

    it("passes an axe smoke test closed and open", async () => {
        const { container } = renderWithProviders(<ThemeToggle />);
        await expectAccessible(container);
        await openMenu();
        await expectAccessible(document.body);
    });
});
