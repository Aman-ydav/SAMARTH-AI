import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { expectAccessible } from "@/test/axeCheck";
import { renderWithProviders } from "@/test/renderWithProviders";

describe("PageSkeleton", () => {
    it("announces loading with a status role and renders placeholder blocks", () => {
        const { container } = renderWithProviders(<PageSkeleton />);
        expect(
            screen.getByRole("status", { name: "Loading page" })
        ).toBeInTheDocument();
        expect(
            container.querySelectorAll('[data-slot="skeleton"]').length
        ).toBeGreaterThan(2);
    });

    it("passes an axe smoke test", async () => {
        const { container } = renderWithProviders(<PageSkeleton />);
        await expectAccessible(container);
    });
});
