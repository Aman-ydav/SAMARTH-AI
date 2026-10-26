import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "@/mocks/server";

/** Starts the MSW server for one test file; any request without a handler fails the test (TEST-15). */
export function setupMockServer() {
    beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
    afterEach(() => server.resetHandlers());
    afterAll(() => server.close());
    return server;
}
