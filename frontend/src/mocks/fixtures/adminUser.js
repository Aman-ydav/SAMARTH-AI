/** Factory for one account of `GET /admin/users` (backend `AdminUser`). Reserved example.test domain only (TEST-20). */
export function makeAdminUser(overrides = {}) {
    return {
        id: "64b7f0c2a1b2c3d4e5f60301",
        email: "ravi.kumar@example.test",
        name: "Ravi Kumar",
        role: "learner",
        status: "active",
        emailVerified: true,
        authProviders: ["password"],
        mustChangePassword: false,
        lastLoginAt: "2026-10-26T09:00:00.000Z",
        createdAt: "2026-10-01T09:00:00.000Z",
        ...overrides,
    };
}
