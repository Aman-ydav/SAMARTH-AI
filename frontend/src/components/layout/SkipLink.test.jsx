import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { SkipLink } from "@/components/layout/SkipLink";
import { i18n } from "@/i18n";
import { expectAccessible } from "@/test/axeCheck";
import { renderWithProviders } from "@/test/renderWithProviders";

describe("SkipLink", () => {
    afterEach(() => i18n.changeLanguage("en"));

    it("is the first tab stop and targets the main landmark", async () => {
        renderWithProviders(
            <>
                <SkipLink />
                <button type="button">next</button>
            </>
        );
        await userEvent.tab();
        const link = screen.getByRole("link", { name: "Skip to main content" });
        expect(link).toHaveFocus();
        expect(link).toHaveAttribute("href", "#main-content");
    });

    it("is translated", async () => {
        await i18n.changeLanguage("hi");
        renderWithProviders(<SkipLink />);
        expect(
            screen.getByRole("link", { name: "मुख्य सामग्री पर जाएँ" })
        ).toBeInTheDocument();
    });

    it("passes an axe smoke test", async () => {
        const { container } = renderWithProviders(<SkipLink />);
        await expectAccessible(container);
    });
});
