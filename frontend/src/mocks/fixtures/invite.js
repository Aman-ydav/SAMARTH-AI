/** Factory for one invitation of `GET /admin/invites` (backend `AdminInvite`). Reserved example.test domain only (TEST-20). */
export function makeInvite(overrides = {}) {
    return {
        id: "64b7f0c2a1b2c3d4e5f60201",
        email: "meera.nair@example.test",
        role: "trainer",
        status: "sent",
        departmentId: null,
        invitedBy: "64b7f0c2a1b2c3d4e5f60002",
        resentCount: 0,
        expiresAt: "2026-11-03T09:00:00.000Z",
        acceptedAt: null,
        createdAt: "2026-10-27T09:00:00.000Z",
        ...overrides,
    };
}
