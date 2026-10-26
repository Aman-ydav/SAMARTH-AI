import request from "supertest";
import { createApp } from "#app";
import { createEmailService } from "#services/email.service.js";
import { createLogger } from "#utils/logger.js";
import { makeTestEnv } from "./testEnv.js";

const silent = createLogger({ level: "silent", isDevelopment: false });

/**
 * Builds a fresh app for a test (own rate-limit counters, own email service). `env` takes raw env overrides that go
 * through the real parser, e.g. `{ NODE_ENV: "production", COOKIE_SAMESITE: "none" }`.
 * `mountRoutes(api)` adds the routes under test to the `/api/v1` router, after CSRF.
 */
export function buildApp({
    env: envOverrides = {},
    mountRoutes,
    readinessCheck = async () => true,
    emailService,
    log = silent,
} = {}) {
    const config = makeTestEnv(envOverrides);
    const service = emailService ?? createEmailService({ config, log });
    const app = createApp({
        config,
        mountRoutes,
        readinessCheck,
        log,
        emailService: service,
    });
    return { app, config, emailService: service };
}

/** Reads a cookie value out of Set-Cookie headers (undefined when absent). */
export function readSetCookie(response, name) {
    const header = [response.headers["set-cookie"] ?? []]
        .flat()
        .find((line) => line.startsWith(`${name}=`));
    return header
        ? decodeURIComponent(header.split(";")[0].slice(name.length + 1))
        : undefined;
}

/** The full Set-Cookie line for a cookie (attributes included). */
export const setCookieLine = (response, name) =>
    [response.headers["set-cookie"] ?? []]
        .flat()
        .find((line) => line.startsWith(`${name}=`));

/**
 * Supertest agent with a cookie jar that has already received `sai_csrf` (TEST-10).
 * `agent.post(url)` etc. work as usual; use `csrf.post(url)` to send the matching `X-CSRF-Token` automatically.
 */
export async function createCsrfAgent(app, { headers = {} } = {}) {
    const agent = request.agent(app);
    const prime = await agent.get("/api/v1/__csrf-prime__").set(headers);
    const token = readSetCookie(prime, "sai_csrf");
    const withToken = (method) => (url) =>
        agent[method](url).set(headers).set("X-CSRF-Token", token);
    return {
        agent,
        token,
        get: (url) => agent.get(url).set(headers),
        post: withToken("post"),
        put: withToken("put"),
        patch: withToken("patch"),
        delete: withToken("delete"),
    };
}

export { request };
