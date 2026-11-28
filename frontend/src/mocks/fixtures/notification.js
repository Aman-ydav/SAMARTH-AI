/** A notification as `GET /me/notifications` returns it (doc 08 section 6.3); override any field. */
export function makeNotification(overrides = {}) {
    return {
        id: "64b7f0c2a1b2c3d4e5f60718",
        type: "job.completed",
        subject: "content.extract-text",
        refId: "64b7f0c2a1b2c3d4e5f60719",
        link: null,
        read: false,
        readAt: null,
        createdAt: "2026-11-28T10:00:00.000Z",
        ...overrides,
    };
}
