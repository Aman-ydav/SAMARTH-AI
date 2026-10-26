import { describe, expect, it } from "vitest";
import { useReturnTo } from "@/features/auth";
import { renderHookWithProviders } from "@/test/renderWithProviders";

const run = (route, fallback) =>
    renderHookWithProviders(() => useReturnTo(fallback), { route }).result
        .current;

describe("useReturnTo", () => {
    it("reads a safe return path from the query", () => {
        expect(run("/login?returnTo=%2Fgaps")).toBe("/gaps");
    });

    it("rejects hostile values", () => {
        expect(run("/login?returnTo=%2F%2Fevil.example.test")).toBe(
            "/dashboard"
        );
        expect(run("/login?returnTo=https%3A%2F%2Fevil.example.test")).toBe(
            "/dashboard"
        );
    });

    it("uses the fallback when nothing is carried", () => {
        expect(run("/login", "/onboarding")).toBe("/onboarding");
    });

    it("reads router state first", () => {
        expect(run({ pathname: "/login", state: { returnTo: "/chat" } })).toBe(
            "/chat"
        );
    });
});
