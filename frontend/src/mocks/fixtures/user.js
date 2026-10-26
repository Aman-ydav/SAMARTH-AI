/** Factory for the `/auth/me` user summary (doc 08 section 3). Reserved example.test domain only (TEST-20). */
export function makeUser(overrides = {}) {
    return {
        id: "64b7f0c2a1b2c3d4e5f60001",
        email: "asha.verma@example.test",
        name: "Asha Verma",
        role: "learner",
        orgId: "64b7f0c2a1b2c3d4e5f6aaaa",
        status: "active",
        locale: "en",
        emailVerified: true,
        authProviders: ["password"],
        hasPassword: true,
        avatar: null,
        mustChangePassword: false,
        ...overrides,
    };
}

/** `data` of login-type responses: the user summary plus the onboarding flag. */
export function makeSessionData(overrides = {}, userOverrides = {}) {
    return {
        user: makeUser(userOverrides),
        needsOnboarding: false,
        ...overrides,
    };
}
