import request from "supertest";
import { readSetCookie } from "./appFactory.js";

const COOKIE_ACCESS = { domain: "127.0.0.1", secure: false, script: false };

/**
 * A Supertest agent with a cookie jar that follows the `sai_csrf` cookie as it rotates (login, refresh, logout) and
 * sends it back in `X-CSRF-Token` on unsafe methods (TEST-10). After a response that clears the cookie call `prime()`.
 *
 * `agent.jar` is the real cookie jar, so `cookie(name)` shows exactly what a browser would hold and send.
 */
export async function createAuthAgent(app, { headers = {} } = {}) {
    const agent = request.agent(app);
    const state = { csrf: undefined };

    const track = (test) =>
        test.on("response", (res) => {
            const value = readSetCookie(res, "sai_csrf");
            if (value !== undefined) state.csrf = value || undefined;
        });
    const safe = (method) => (url) => track(agent[method](url).set(headers));
    const unsafe = (method) => (url) =>
        track(
            agent[method](url)
                .set(headers)
                .set("X-CSRF-Token", state.csrf ?? "")
        );

    const prime = async () => {
        await track(agent.get("/api/v1/__csrf-prime__").set(headers));
        return state.csrf;
    };
    await prime();

    return {
        agent,
        prime,
        get: safe("get"),
        post: unsafe("post"),
        put: unsafe("put"),
        patch: unsafe("patch"),
        delete: unsafe("delete"),
        get csrf() {
            return state.csrf;
        },
        /** A cookie as the browser would send it to `path` (undefined when absent or expired). */
        cookie(name, path = "/") {
            return agent.jar.getCookie(name, { ...COOKIE_ACCESS, path })?.value;
        },
    };
}

/**
 * One request with hand-built cookies and CSRF header and no jar: replays an old refresh token, sends a tampered cookie, etc.
 */
export function rawRequest(
    app,
    method,
    url,
    { cookies = {}, csrf = "x".repeat(43), body, headers = {} } = {}
) {
    const pairs = Object.entries({ sai_csrf: csrf, ...cookies }).map(
        ([name, value]) => `${name}=${value}`
    );
    const test = request(app)[method](url).set("Cookie", pairs.join("; "));
    if (!["get", "head"].includes(method)) test.set("X-CSRF-Token", csrf);
    test.set(headers);
    return body === undefined ? test : test.send(body);
}
