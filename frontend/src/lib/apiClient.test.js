import { HttpResponse, delay, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/apiClient";
import { API_EVENTS, apiEvents } from "@/lib/apiEvents";
import {
    apiUrl,
    errorResponse as fail,
    okResponse as ok,
} from "@/mocks/fixtures/envelope";
import { setupMockServer } from "@/test/mockServerLifecycle";

const server = setupMockServer();

const expire = (name) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
};

/** Registers a handler and returns a live call counter; the resolver also receives the request info. */
function on(method, path, resolver) {
    const tally = { calls: 0 };
    server.use(
        http[method](apiUrl(path), (info) => {
            tally.calls += 1;
            return resolver(info, tally);
        })
    );
    return tally;
}

const failure = async (promise) => {
    try {
        await promise;
    } catch (error) {
        return error;
    }
    return null;
};

const settle = async () => {
    for (let step = 0; step < 30; step += 1)
        await vi.advanceTimersByTimeAsync(250);
};

let sessionEvents;
let wakingEvents;

beforeEach(() => {
    sessionEvents = [];
    wakingEvents = [];
    apiEvents.on(API_EVENTS.SESSION_EXPIRED, (detail) =>
        sessionEvents.push(detail)
    );
    apiEvents.on(API_EVENTS.SERVER_WAKING, (detail) =>
        wakingEvents.push(detail.active)
    );
});

afterEach(() => {
    apiEvents.clear();
    expire("sai_csrf");
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("apiClient: success and envelope", () => {
    it("unwraps the success envelope", async () => {
        on("get", "/things", () =>
            ok({ items: [1, 2] }, { meta: { page: 1 }, message: "Listed" })
        );
        expect(await apiClient.get("/things")).toMatchObject({
            success: true,
            message: "Listed",
            data: { items: [1, 2] },
            meta: { page: 1 },
        });
    });

    it("turns an empty 204 into { success: true, data: null }", async () => {
        on(
            "delete",
            "/things/1",
            () => new HttpResponse(null, { status: 204 })
        );
        expect(await apiClient.delete("/things/1")).toEqual({
            success: true,
            data: null,
        });
    });

    it("rejects a 2xx that is not the envelope with INVALID_RESPONSE", async () => {
        on(
            "get",
            "/things",
            () =>
                new HttpResponse("<html>spa fallback</html>", {
                    headers: {
                        "Content-Type": "text/html",
                        "X-Request-Id": "req-html",
                    },
                })
        );
        expect(await failure(apiClient.get("/things"))).toMatchObject({
            name: "ApiError",
            code: "INVALID_RESPONSE",
            statusCode: 200,
            requestId: "req-html",
        });
    });

    it("passes blob responses through untouched and parses blob error bodies", async () => {
        on(
            "get",
            "/files/1",
            () =>
                new HttpResponse("PDFDATA", {
                    headers: { "Content-Type": "application/pdf" },
                })
        );
        const response = await apiClient.get("/files/1", {
            responseType: "blob",
        });
        expect(response.data).toBeInstanceOf(Blob);
        on("get", "/files/2", () => fail(404, "MEDIA_NOT_FOUND"));
        expect(
            await failure(apiClient.get("/files/2", { responseType: "blob" }))
        ).toMatchObject({ statusCode: 404, code: "MEDIA_NOT_FOUND" });
    });
});

describe("apiClient: request headers", () => {
    it("sends a fresh X-Request-Id on every request and never an Authorization header", async () => {
        const seen = [];
        on("get", "/things", ({ request }) => {
            seen.push([
                request.headers.get("x-request-id"),
                request.headers.get("authorization"),
            ]);
            return ok(null);
        });
        await apiClient.get("/things");
        await apiClient.get("/things");
        expect(seen[0][0]).toBeTruthy();
        expect(seen[0][0]).not.toBe(seen[1][0]);
        expect(seen.map(([, authorization]) => authorization)).toEqual([
            null,
            null,
        ]);
    });

    it("adds X-CSRF-Token from the sai_csrf cookie on unsafe methods only", async () => {
        document.cookie = "sai_csrf=csrf-value-1; path=/";
        const seen = {};
        for (const method of ["get", "post", "put", "patch", "delete"]) {
            on(method, "/echo", ({ request }) => {
                seen[method] = request.headers.get("x-csrf-token");
                return ok(null);
            });
            await apiClient.request({ url: "/echo", method });
        }
        expect(seen).toEqual({
            get: null,
            post: "csrf-value-1",
            put: "csrf-value-1",
            patch: "csrf-value-1",
            delete: "csrf-value-1",
        });
    });

    it("omits the CSRF header when the cookie is absent", async () => {
        let header = "unset";
        on("post", "/echo", ({ request }) => {
            header = request.headers.get("x-csrf-token");
            return ok(null);
        });
        await apiClient.post("/echo", {});
        expect(header).toBeNull();
    });

    it("is configured once with credentials and a 30 s timeout", () => {
        expect(apiClient.defaults.withCredentials).toBe(true);
        expect(apiClient.defaults.timeout).toBe(30000);
        expect(apiClient.defaults.baseURL).toBe("/api/v1");
    });
});

describe("apiClient: error normalisation", () => {
    it("maps an error envelope to the ApiError shape", async () => {
        on("post", "/things", () =>
            fail(400, "VALIDATION_ERROR", {
                message: "Bad input",
                errors: [
                    {
                        field: "email",
                        message: "Invalid",
                        code: "invalid_string",
                    },
                ],
                requestId: "req-42",
            })
        );
        expect(await failure(apiClient.post("/things", {}))).toMatchObject({
            statusCode: 400,
            code: "VALIDATION_ERROR",
            message: "Bad input",
            errors: [
                { field: "email", message: "Invalid", code: "invalid_string" },
            ],
            requestId: "req-42",
            retryAfterSec: null,
        });
    });

    it("maps an HTML 500 to SERVER_ERROR with the header request id", async () => {
        on(
            "post",
            "/things",
            () =>
                new HttpResponse("<h1>oops</h1>", {
                    status: 500,
                    headers: {
                        "Content-Type": "text/html",
                        "X-Request-Id": "req-500",
                    },
                })
        );
        expect(await failure(apiClient.post("/things", {}))).toMatchObject({
            statusCode: 500,
            code: "SERVER_ERROR",
            requestId: "req-500",
        });
    });

    it("parses Retry-After on 429 and never retries it", async () => {
        const tally = on("get", "/things", () =>
            fail(429, "RATE_LIMITED", {
                headers: { "Retry-After": "42" },
            })
        );
        expect(await failure(apiClient.get("/things"))).toMatchObject({
            statusCode: 429,
            code: "RATE_LIMITED",
            retryAfterSec: 42,
        });
        expect(tally.calls).toBe(1);
    });

    it("reports TIMEOUT when the request exceeds its timeout", async () => {
        on("post", "/slow", async () => {
            await delay(60);
            return ok(null);
        });
        expect(
            await failure(apiClient.post("/slow", {}, { timeout: 10 }))
        ).toMatchObject({ code: "TIMEOUT", statusCode: 0 });
    });

    it("reports NETWORK_ERROR when the connection fails", async () => {
        on("post", "/down", () => HttpResponse.error());
        expect(await failure(apiClient.post("/down", {}))).toMatchObject({
            code: "NETWORK_ERROR",
            statusCode: 0,
        });
    });

    it("fails fast with OFFLINE and sends nothing while the browser is offline", async () => {
        const tally = on("get", "/things", () => ok(null));
        vi.stubGlobal("navigator", { ...navigator, onLine: false });
        expect(await failure(apiClient.get("/things"))).toMatchObject({
            code: "OFFLINE",
        });
        expect(tally.calls).toBe(0);
    });

    it("reports REQUEST_CANCELED for an aborted request", async () => {
        on("get", "/things", async () => {
            await delay(60);
            return ok(null);
        });
        const controller = new AbortController();
        const pending = failure(
            apiClient.get("/things", { signal: controller.signal })
        );
        controller.abort();
        expect(await pending).toMatchObject({ code: "REQUEST_CANCELED" });
    });
});

describe("apiClient: 401 handling and single-flight refresh", () => {
    function mountSessionApi({
        tokenValidAfterRefresh = true,
        refreshResponse,
    } = {}) {
        let refreshed = false;
        const refresh = on("post", "/auth/refresh", async () => {
            await delay(10);
            if (refreshResponse) return refreshResponse();
            refreshed = true;
            return ok(null);
        });
        const things = on("get", "/things", () =>
            refreshed && tokenValidAfterRefresh
                ? ok({ ok: true })
                : fail(401, "TOKEN_EXPIRED")
        );
        return { refresh, things };
    }

    it("refreshes once on TOKEN_EXPIRED and replays the request", async () => {
        const { refresh, things } = mountSessionApi();
        expect((await apiClient.get("/things")).data).toEqual({ ok: true });
        expect([refresh.calls, things.calls]).toEqual([1, 2]);
        expect(sessionEvents).toHaveLength(0);
    });

    it("refreshes on AUTH_REQUIRED too", async () => {
        let refreshed = false;
        on("post", "/auth/refresh", () => {
            refreshed = true;
            return ok(null);
        });
        on("get", "/things", () =>
            refreshed ? ok("fine") : fail(401, "AUTH_REQUIRED")
        );
        expect((await apiClient.get("/things")).data).toBe("fine");
    });

    it("shares ONE refresh between 5 parallel 401s and replays every request", async () => {
        const { refresh, things } = mountSessionApi();
        const results = await Promise.all(
            Array.from({ length: 5 }, () => apiClient.get("/things"))
        );
        expect(results.every((envelope) => envelope.data.ok === true)).toBe(
            true
        );
        expect([refresh.calls, things.calls]).toEqual([1, 10]);
    });

    it("replays an unsafe request with the rotated CSRF cookie", async () => {
        document.cookie = "sai_csrf=old-token; path=/";
        const seen = [];
        let refreshed = false;
        on("post", "/auth/refresh", () => {
            refreshed = true;
            document.cookie = "sai_csrf=new-token; path=/";
            return ok(null);
        });
        on("post", "/things", ({ request }) => {
            seen.push(request.headers.get("x-csrf-token"));
            return refreshed ? ok("saved") : fail(401, "TOKEN_EXPIRED");
        });
        expect((await apiClient.post("/things", { a: 1 })).data).toBe("saved");
        expect(seen).toEqual(["old-token", "new-token"]);
    });

    it("retries only once: a second 401 after a good refresh is returned, not looped", async () => {
        const { refresh, things } = mountSessionApi({
            tokenValidAfterRefresh: false,
        });
        expect(await failure(apiClient.get("/things"))).toMatchObject({
            statusCode: 401,
            code: "TOKEN_EXPIRED",
        });
        expect([refresh.calls, things.calls]).toEqual([1, 2]);
        expect(sessionEvents).toHaveLength(0);
    });

    it("ends the session when the refresh itself is rejected", async () => {
        const { refresh, things } = mountSessionApi({
            refreshResponse: () => fail(401, "REFRESH_INVALID"),
        });
        expect(await failure(apiClient.get("/things"))).toMatchObject({
            statusCode: 401,
            code: "REFRESH_INVALID",
        });
        expect([refresh.calls, things.calls]).toEqual([1, 1]);
        expect(sessionEvents).toEqual([
            { reason: "SESSION_EXPIRED", code: "REFRESH_INVALID" },
        ]);
    });

    it.each([
        ["a 5xx", () => fail(503, "INTEGRATION_ERROR"), { statusCode: 503 }],
        [
            "a network failure",
            () => HttpResponse.error(),
            { code: "NETWORK_ERROR" },
        ],
    ])(
        "keeps the session when the refresh fails with %s",
        async (_name, refreshResponse, expected) => {
            mountSessionApi({ refreshResponse });
            expect(await failure(apiClient.get("/things"))).toMatchObject(
                expected
            );
            expect(sessionEvents).toHaveLength(0);
        }
    );

    it("does not refresh for SESSION_REVOKED and announces the session end", async () => {
        const refresh = on("post", "/auth/refresh", () => ok(null));
        on("get", "/things", () => fail(401, "SESSION_REVOKED"));
        expect(await failure(apiClient.get("/things"))).toMatchObject({
            code: "SESSION_REVOKED",
        });
        expect(refresh.calls).toBe(0);
        expect(sessionEvents).toEqual([
            { reason: "SESSION_REVOKED", code: "SESSION_REVOKED" },
        ]);
    });

    it("does not refresh for INVALID_CREDENTIALS or MUST_CHANGE_PASSWORD", async () => {
        const refresh = on("post", "/auth/refresh", () => ok(null));
        on("post", "/auth/login", () => fail(401, "INVALID_CREDENTIALS"));
        on("get", "/things", () => fail(403, "MUST_CHANGE_PASSWORD"));
        expect(await failure(apiClient.post("/auth/login", {}))).toMatchObject({
            code: "INVALID_CREDENTIALS",
        });
        expect(await failure(apiClient.get("/things"))).toMatchObject({
            code: "MUST_CHANGE_PASSWORD",
        });
        expect(refresh.calls).toBe(0);
        expect(sessionEvents).toHaveLength(0);
    });

    it("never refreshes for /auth/* calls, even on TOKEN_EXPIRED", async () => {
        const refresh = on("post", "/auth/refresh", () => ok(null));
        on("post", "/auth/change-password", () => fail(401, "TOKEN_EXPIRED"));
        on("get", "/auth/sessions", () => fail(401, "AUTH_REQUIRED"));
        expect(
            await failure(apiClient.post("/auth/change-password", {}))
        ).toMatchObject({ code: "TOKEN_EXPIRED" });
        expect(await failure(apiClient.get("/auth/sessions"))).toMatchObject({
            code: "AUTH_REQUIRED",
        });
        expect(refresh.calls).toBe(0);
    });
});

describe("apiClient: boot hydrate exception (R5)", () => {
    const boot = { sai: { bootRefresh: true, silentSessionEnd: true } };

    function mountBoot({ meAfterRefresh, refreshResponse }) {
        let refreshed = false;
        const refresh = on("post", "/auth/refresh", () => {
            const response = refreshResponse();
            refreshed = response.status === 200;
            return response;
        });
        const me = on("get", "/auth/me", () =>
            refreshed ? meAfterRefresh() : fail(401, "TOKEN_EXPIRED")
        );
        return { me, refresh };
    }

    it("does exactly one refresh, then retries /auth/me once", async () => {
        const { me, refresh } = mountBoot({
            meAfterRefresh: () => ok({ user: { id: "1" } }),
            refreshResponse: () => ok(null),
        });
        expect((await apiClient.get("/auth/me", boot)).data.user.id).toBe("1");
        expect([me.calls, refresh.calls]).toEqual([2, 1]);
    });

    it("treats a failed boot refresh as anonymous without a session-expired event", async () => {
        const { me, refresh } = mountBoot({
            meAfterRefresh: () => ok(null),
            refreshResponse: () => fail(401, "REFRESH_INVALID"),
        });
        expect(await failure(apiClient.get("/auth/me", boot))).toMatchObject({
            statusCode: 401,
            code: "REFRESH_INVALID",
        });
        expect([me.calls, refresh.calls]).toEqual([1, 1]);
        expect(sessionEvents).toHaveLength(0);
    });

    it("announces the session end when a signed-in user fails the boot-style refresh", async () => {
        mountBoot({
            meAfterRefresh: () => ok(null),
            refreshResponse: () => fail(401, "REFRESH_INVALID"),
        });
        await failure(
            apiClient.get("/auth/me", { sai: { bootRefresh: true } })
        );
        expect(sessionEvents).toHaveLength(1);
    });

    it("does not refresh /auth/me without the boot flag", async () => {
        const { me, refresh } = mountBoot({
            meAfterRefresh: () => ok(null),
            refreshResponse: () => ok(null),
        });
        await failure(apiClient.get("/auth/me"));
        expect([me.calls, refresh.calls]).toEqual([1, 0]);
    });

    it("stops after one retry even if /auth/me still answers 401", async () => {
        const { me, refresh } = mountBoot({
            meAfterRefresh: () => fail(401, "AUTH_REQUIRED"),
            refreshResponse: () => ok(null),
        });
        expect(await failure(apiClient.get("/auth/me", boot))).toMatchObject({
            code: "AUTH_REQUIRED",
        });
        expect([me.calls, refresh.calls]).toEqual([2, 1]);
    });
});

describe("apiClient: CSRF failures", () => {
    it("re-reads /auth/me once and replays the request once", async () => {
        document.cookie = "sai_csrf=stale; path=/";
        const me = on("get", "/auth/me", () => {
            document.cookie = "sai_csrf=fresh; path=/";
            return ok({ user: {} });
        });
        const post = on("post", "/things", ({ request }) =>
            request.headers.get("x-csrf-token") === "fresh"
                ? ok("done")
                : fail(403, "CSRF_INVALID")
        );
        expect((await apiClient.post("/things", {})).data).toBe("done");
        expect([post.calls, me.calls]).toEqual([2, 1]);
    });

    it("gives up after one replay", async () => {
        const me = on("get", "/auth/me", () => ok({ user: {} }));
        const post = on("post", "/things", () => fail(403, "CSRF_INVALID"));
        expect(await failure(apiClient.post("/things", {}))).toMatchObject({
            statusCode: 403,
            code: "CSRF_INVALID",
        });
        expect([post.calls, me.calls]).toEqual([2, 1]);
    });
});

describe("apiClient: retry policy and cold start", () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    });

    it("retries GET twice on network failure with backoff, then succeeds", async () => {
        const tally = on("get", "/things", (info, { calls }) =>
            calls < 3 ? HttpResponse.error() : ok("recovered")
        );
        const pending = apiClient.get("/things");
        await settle();
        expect((await pending).data).toBe("recovered");
        expect(tally.calls).toBe(3);
    });

    it("gives up after two retries on repeated 503", async () => {
        const tally = on("get", "/things", () =>
            fail(503, "INTEGRATION_ERROR")
        );
        const pending = failure(apiClient.get("/things"));
        await settle();
        expect(await pending).toMatchObject({ statusCode: 503 });
        expect(tally.calls).toBe(3);
    });

    it("never retries mutations", async () => {
        const tally = on("post", "/things", () =>
            fail(503, "INTEGRATION_ERROR")
        );
        const pending = failure(apiClient.post("/things", {}));
        await settle();
        await pending;
        expect(tally.calls).toBe(1);
    });

    it("does not retry client errors", async () => {
        const tally = on("get", "/things", () => fail(404, "NOT_FOUND"));
        await failure(apiClient.get("/things"));
        expect(tally.calls).toBe(1);
    });

    it("raises the waking-up event after 3 s and clears it when the response arrives", async () => {
        let release;
        on("get", "/slow", async () => {
            await new Promise((resolve) => {
                release = resolve;
            });
            return ok("late");
        });
        const pending = apiClient.get("/slow");
        await vi.advanceTimersByTimeAsync(2500);
        expect(wakingEvents).toEqual([]);
        await vi.advanceTimersByTimeAsync(600);
        expect(wakingEvents).toEqual([true]);
        release();
        await vi.advanceTimersByTimeAsync(10);
        expect((await pending).data).toBe("late");
        expect(wakingEvents).toEqual([true, false]);
    });
});
