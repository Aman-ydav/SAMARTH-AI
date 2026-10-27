import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrustChain } from "@/features/marketing/components/TrustChain";
import { CHAIN_BLOCKS } from "@/features/marketing/data/landingContent";
import { expectAccessible } from "@/test/axeCheck";
import { MOTION_TIER_CASES, setMotionTier } from "@/test/motionTier";
import { renderWithProviders } from "@/test/renderWithProviders";

describe("TrustChain", () => {
    it.each(MOTION_TIER_CASES)(
        "shows four linked, verified audit entries and an honest caption on the %s tier",
        (tier) => {
            setMotionTier(tier);
            const { container } = renderWithProviders(<TrustChain />);
            expect(screen.getAllByRole("listitem")).toHaveLength(
                CHAIN_BLOCKS.length
            );
            expect(screen.getByText("Entry 1")).toBeInTheDocument();
            expect(screen.getByText("Entry 4")).toBeInTheDocument();
            expect(screen.getAllByText("Verified")).toHaveLength(4);
            expect(
                screen.getByText(/Illustration: audit entries linked by hashes/)
            ).toBeInTheDocument();
            expect(container.querySelectorAll("span.bg-primary")).toHaveLength(
                3
            );
        }
    );

    it("names the hash of the previous entry in every entry after the first", () => {
        setMotionTier("reduced");
        renderWithProviders(<TrustChain />);
        const hashes = screen.getAllByText(/^[0-9a-f]{4}$/);
        expect(hashes.map((node) => node.textContent)).toEqual([
            "0000",
            "9f3a",
            "9f3a",
            "c71e",
            "c71e",
            "2b8d",
            "2b8d",
            "e540",
        ]);
    });

    it("has no axe violations", async () => {
        setMotionTier("reduced");
        const { container } = renderWithProviders(<TrustChain />);
        await expectAccessible(container);
    });
});
