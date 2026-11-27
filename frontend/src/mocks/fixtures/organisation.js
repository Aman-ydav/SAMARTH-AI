export function makeOrganisation(overrides = {}) {
    return {
        id: "000000000000000000000001",
        name: "SAMARTH AI",
        code: "default",
        active: true,
        version: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        settings: {
            allowSelfRegistration: true,
            allowedEmailDomains: [],
            requireEmailVerification: true,
            allowGoogleLogin: true,
        },
        ...overrides,
    };
}
