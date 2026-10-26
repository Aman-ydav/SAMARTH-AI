import { authInitialState } from "@/features/auth";
import { makeUser } from "@/mocks/fixtures/user";

/** Preloaded `auth` slice for a hydrated, signed-out visitor. */
export const anonymousAuth = {
    ...authInitialState,
    bootstrapped: true,
    status: "succeeded",
};

/** Preloaded `auth` slice for a signed-in user. */
export function signedInAuth(userOverrides = {}, extra = {}) {
    return {
        ...authInitialState,
        bootstrapped: true,
        status: "succeeded",
        user: { ...makeUser(), needsOnboarding: false, ...userOverrides },
        ...extra,
    };
}
