import { screen } from "@testing-library/react";
import { Link } from "react-router";
import { describe, expect, it } from "vitest";
import { Logo } from "@/components/layout/Logo";
import { expectAccessible } from "@/test/axeCheck";
import { renderWithProviders } from "@/test/renderWithProviders";

describe("Logo", () => {
    it("shows the wordmark and exposes the brand name once", () => {
        const { container } = renderWithProviders(<Logo />);
        expect(container.textContent).toContain("SAMARTH");
        expect(container.textContent).toContain("AI");
        expect(screen.getByText("SAMARTH AI")).toHaveClass("sr-only");
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("keeps an accessible name when the wordmark is hidden", () => {
        renderWithProviders(<Logo showWordmark={false} />);
        expect(
            screen.getByRole("img", { name: "SAMARTH AI" })
        ).toBeInTheDocument();
        expect(screen.queryByText("SAMARTH")).not.toBeInTheDocument();
    });

    it("gives a link its brand-name accessible name", () => {
        renderWithProviders(
            <Link to="/">
                <Logo />
            </Link>
        );
        expect(
            screen.getByRole("link", { name: "SAMARTH AI" })
        ).toBeInTheDocument();
    });

    it("uses token classes only (no literal colours) and is not a heading", () => {
        const { container } = renderWithProviders(<Logo />);
        expect(container.innerHTML).not.toMatch(
            /#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i
        );
        expect(container.querySelector("svg .fill-primary")).not.toBeNull();
        expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    });

    it("passes an axe smoke test in both forms", async () => {
        const { container, rerender } = renderWithProviders(<Logo />);
        await expectAccessible(container);
        rerender(<Logo showWordmark={false} className="h-6" />);
        await expectAccessible(container);
    });
});
