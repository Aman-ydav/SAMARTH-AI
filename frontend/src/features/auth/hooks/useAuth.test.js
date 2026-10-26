import { describe, expect, it } from "vitest";
import { useAuth } from "@/features/auth";
import { anonymousAuth, signedInAuth } from "@/test/authState";
import { renderHookWithProviders } from "@/test/renderWithProviders";

const read = (auth) =>
    renderHookWithProviders(() => useAuth(), { preloadedState: { auth } })
        .result.current;

describe("useAuth", () => {
    it("describes an anonymous visitor", () => {
        expect(read(anonymousAuth)).toMatchObject({
            user: null,
            role: null,
            isAuthenticated: false,
            bootstrapped: true,
        });
    });

    it("describes a signed-in user", () => {
        expect(
            read(
                signedInAuth({
                    role: "trainer",
                    needsOnboarding: true,
                    mustChangePassword: true,
                })
            )
        ).toMatchObject({
            role: "trainer",
            isAuthenticated: true,
            needsOnboarding: true,
            mustChangePassword: true,
        });
    });
});
