/** Factory for one device session row of `GET /auth/sessions`. */
export function makeSession(overrides = {}) {
    return {
        id: "64b7f0c2a1b2c3d4e5f60101",
        device: "Chrome on Windows",
        createdAt: "2026-10-20T09:00:00.000Z",
        lastUsedAt: "2026-10-26T09:00:00.000Z",
        current: true,
        ...overrides,
    };
}
