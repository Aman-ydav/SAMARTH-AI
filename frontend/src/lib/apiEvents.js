export const API_EVENTS = Object.freeze({
    SESSION_EXPIRED: "session-expired",
    SERVER_WAKING: "server-waking",
});

const listeners = new Map();

/** Subscribes to an apiClient event; returns the unsubscribe function. */
function on(type, handler) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(handler);
    return () => listeners.get(type)?.delete(handler);
}

function emit(type, detail = {}) {
    for (const handler of [...(listeners.get(type) ?? [])]) {
        try {
            handler(detail);
        } catch (error) {
            // A faulty subscriber must not break the request pipeline; surface it to the global error handler instead.
            queueMicrotask(() => {
                throw error;
            });
        }
    }
}

function clear() {
    listeners.clear();
}

/** Tiny pub/sub that decouples lib/apiClient.js from the store and router (FE-46, FE-48, FE-58). */
export const apiEvents = { on, emit, clear };
