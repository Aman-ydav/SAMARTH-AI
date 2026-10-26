import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LanguageSwitch } from "@/components/layout/LanguageSwitch";
import { i18n } from "@/i18n";
import { expectAccessible } from "@/test/axeCheck";
import { renderWithProviders } from "@/test/renderWithProviders";

describe("LanguageSwitch", () => {
    beforeEach(() => window.localStorage.clear());
    afterEach(async () => {
        window.localStorage.clear();
        await i18n.changeLanguage("en");
    });

    it("lists English and Hindi with the current language checked", async () => {
        renderWithProviders(<LanguageSwitch />);
        await userEvent.click(screen.getByRole("button", { name: "Language" }));
        expect(
            screen.getByRole("menuitemradio", { name: "English" })
        ).toBeChecked();
        expect(
            screen.getByRole("menuitemradio", { name: "हिन्दी" })
        ).not.toBeChecked();
    });

    it("switches the whole interface, persists sai-lang and sets <html lang>", async () => {
        const { store } = renderWithProviders(<LanguageSwitch />);
        await userEvent.click(screen.getByRole("button", { name: "Language" }));
        await userEvent.click(
            screen.getByRole("menuitemradio", { name: "हिन्दी" })
        );
        expect(store.getState().ui.language).toBe("hi");
        expect(window.localStorage.getItem("sai-lang")).toBe("hi");
        await waitFor(() => expect(i18n.language).toBe("hi"));
        expect(document.documentElement.lang).toBe("hi");
        expect(
            await screen.findByRole("button", { name: "भाषा" })
        ).toBeInTheDocument();
    });

    it("shows the current language name next to the icon when showLabel is set", () => {
        renderWithProviders(<LanguageSwitch showLabel />);
        expect(
            screen.getByRole("button", { name: "Language" })
        ).toHaveTextContent("English");
    });

    it("marks the Hindi option with its own language for screen readers", async () => {
        renderWithProviders(<LanguageSwitch />);
        await userEvent.click(screen.getByRole("button", { name: "Language" }));
        expect(
            screen.getByRole("menuitemradio", { name: "हिन्दी" })
        ).toHaveAttribute("lang", "hi");
    });

    it("passes an axe smoke test in both variants", async () => {
        const { container, rerender } = renderWithProviders(<LanguageSwitch />);
        await expectAccessible(container);
        rerender(<LanguageSwitch showLabel />);
        await expectAccessible(container);
    });
});
