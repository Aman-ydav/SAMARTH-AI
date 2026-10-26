import { afterEach, vi } from "vitest";

// Per-file setup (TEST-21): never leak fake timers between tests; mocks are restored by the Vitest config.
afterEach(() => {
    vi.useRealTimers();
});
