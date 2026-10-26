import { describe, expect, it } from "vitest";
import { makeTestEnv } from "#tests/helpers/testEnv.js";
import { createCookieHelpers, cookies } from "./cookies.js";

/** Minimal response double that records res.cookie / res.clearCookie calls. */
function fakeRes() {
    const calls = [];
    return {
        calls,
        cookie: (name, value, options) =>
            calls.push({ kind: "set", name, value, options }),
        clearCookie: (name, options) =>
            calls.push({ kind: "clear", name, options }),
    };
}
const byName = (res, name) => res.calls.find((call) => call.name === name);
const DAY = 24 * 3600_000;

describe("cookies (development config)", () => {
    const helpers = createCookieHelpers(
        makeTestEnv({ NODE_ENV: "development" })
    );

    it("sets sai_access HttpOnly, path /, SameSite=Lax, 15 minutes, not Secure outside production", () => {
        const res = fakeRes();
        helpers.setAccessCookie(res, "jwt");
        expect(byName(res, "sai_access")).toMatchObject({
            value: "jwt",
            options: {
                httpOnly: true,
                secure: false,
                sameSite: "lax",
                path: "/",
                maxAge: 15 * 60_000,
            },
        });
    });

    it("sets sai_refresh HttpOnly with path /api/v1/auth; 7 days normal, 30 days remember-me (R6)", () => {
        const normal = fakeRes();
        helpers.setRefreshCookie(normal, "opaque");
        expect(byName(normal, "sai_refresh").options).toMatchObject({
            httpOnly: true,
            path: "/api/v1/auth",
            sameSite: "lax",
            maxAge: 7 * DAY,
        });
        const remembered = fakeRes();
        helpers.setRefreshCookie(remembered, "opaque", { remember: true });
        expect(byName(remembered, "sai_refresh").options.maxAge).toBe(30 * DAY);
    });

    it("sets sai_csrf readable by JS with the same lifetime as the refresh cookie", () => {
        const res = fakeRes();
        helpers.setCsrfCookie(res, "csrf");
        expect(byName(res, "sai_csrf").options).toMatchObject({
            httpOnly: false,
            path: "/",
            sameSite: "lax",
            maxAge: 7 * DAY,
        });
        const remembered = fakeRes();
        helpers.setCsrfCookie(remembered, "csrf", { remember: true });
        expect(byName(remembered, "sai_csrf").options.maxAge).toBe(30 * DAY);
    });

    it("setSessionCookies sets all three, or only access and csrf for the limited session (AUTH-38)", () => {
        const full = fakeRes();
        helpers.setSessionCookies(full, {
            accessToken: "a",
            refreshToken: "r",
            csrfToken: "c",
        });
        expect(full.calls.map((call) => call.name)).toEqual([
            "sai_access",
            "sai_refresh",
            "sai_csrf",
        ]);
        const limited = fakeRes();
        helpers.setSessionCookies(limited, {
            accessToken: "a",
            csrfToken: "c",
        });
        expect(limited.calls.map((call) => call.name)).toEqual([
            "sai_access",
            "sai_csrf",
        ]);
    });

    it("omits the Domain attribute when COOKIE_DOMAIN is unset", () => {
        const res = fakeRes();
        helpers.setAccessCookie(res, "jwt");
        expect(byName(res, "sai_access").options).not.toHaveProperty("domain");
    });
});

describe("cookies (production config)", () => {
    const prod = createCookieHelpers(makeTestEnv({ NODE_ENV: "production" }));

    it("marks every cookie Secure", () => {
        const res = fakeRes();
        prod.setSessionCookies(res, {
            accessToken: "a",
            refreshToken: "r",
            csrfToken: "c",
        });
        expect(res.calls.every((call) => call.options.secure === true)).toBe(
            true
        );
    });
});

describe("cookies (split-origin fallback)", () => {
    const split = createCookieHelpers(
        makeTestEnv({
            NODE_ENV: "production",
            COOKIE_SAMESITE: "none",
            COOKIE_DOMAIN: ".example.test",
        })
    );

    it("uses SameSite=None, Secure and the shared Domain on all three cookies", () => {
        const res = fakeRes();
        split.setSessionCookies(res, {
            accessToken: "a",
            refreshToken: "r",
            csrfToken: "c",
        });
        for (const call of res.calls) {
            expect(call.options).toMatchObject({
                sameSite: "none",
                secure: true,
                domain: ".example.test",
            });
        }
    });
});

describe("clearing uses identical attributes (AUTH-12)", () => {
    it.each([
        ["development", {}],
        ["production", { NODE_ENV: "production" }],
        [
            "split-origin",
            {
                NODE_ENV: "production",
                COOKIE_SAMESITE: "none",
                COOKIE_DOMAIN: ".example.test",
            },
        ],
    ])("%s", (_label, overrides) => {
        const helpers = createCookieHelpers(makeTestEnv(overrides));
        const set = fakeRes();
        helpers.setSessionCookies(set, {
            accessToken: "a",
            refreshToken: "r",
            csrfToken: "c",
        });
        const cleared = fakeRes();
        helpers.clearAuthCookies(cleared);
        expect(cleared.calls.map((call) => call.name)).toEqual([
            "sai_access",
            "sai_refresh",
            "sai_csrf",
        ]);
        for (const clear of cleared.calls) {
            const { maxAge: _maxAge, ...setOptions } = byName(
                set,
                clear.name
            ).options;
            expect(clear.kind).toBe("clear");
            expect(clear.options).toEqual(setOptions);
        }
    });
});

describe("default instance", () => {
    it("uses the validated test environment", () => {
        const res = fakeRes();
        cookies.setAccessCookie(res, "jwt");
        expect(byName(res, "sai_access").options.httpOnly).toBe(true);
    });
});
