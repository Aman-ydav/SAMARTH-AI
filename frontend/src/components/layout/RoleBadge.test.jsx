import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoleBadge } from "@/components/layout/RoleBadge";
import { renderWithProviders } from "@/test/renderWithProviders";

describe("RoleBadge", () => {
    it.each([
        ["learner", "Learner"],
        ["trainer", "Trainer"],
        ["admin", "Admin"],
        ["superadmin", "Platform admin"],
    ])("labels the %s role in words", (role, label) => {
        renderWithProviders(<RoleBadge role={role} />);
        expect(screen.getByText(label)).toBeInTheDocument();
    });

    it("falls back to the learner label for an unknown or missing role", () => {
        renderWithProviders(<RoleBadge role="wizard" />);
        expect(screen.getByText("Learner")).toBeInTheDocument();
    });
});
