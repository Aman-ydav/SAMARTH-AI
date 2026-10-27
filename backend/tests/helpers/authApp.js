import { vi } from "vitest";
import { createAdminRouter } from "#modules/admin/index.js";
import { createAuthRouter } from "#modules/auth/index.js";
import { createUsersRouter } from "#modules/users/index.js";
import { TEST_PASSWORD } from "#tests/factories/user.factory.js";
import { buildApp } from "./appFactory.js";
import { createAuthAgent } from "./authAgent.js";
import { latestToken } from "./outbox.js";

/**
 * Builds an app with the real auth, profile and admin routers on a fresh config, outbox and rate-limit counters.
 * `verifyGoogleCredential` is a stub unless given (TEST-22: no network); `extraRoutes(api, deps)` adds test-only routes.
 */
export function buildAuthApp({
    env,
    verifyGoogleCredential = vi.fn(),
    extraRoutes,
    ...rest
} = {}) {
    return buildApp({
        env,
        ...rest,
        mountRoutes: (api, deps) => {
            api.use(
                "/auth",
                createAuthRouter({ ...deps, verifyGoogleCredential })
            );
            api.use("/profile", createUsersRouter(deps));
            api.use("/admin", createAdminRouter(deps));
            extraRoutes?.(api, deps);
        },
    });
}

/** Registers, reads the token from the outbox, verifies: returns the logged-in agent (the verify call starts a session). */
export async function registerAndVerify(
    app,
    emailService,
    { name = "Ana Learner", email, password },
    headers = {}
) {
    const agent = await createAuthAgent(app, { headers });
    await agent
        .post("/api/v1/auth/register")
        .send({ name, email, password, acceptTerms: true });
    await emailService.whenSettled();
    const token = latestToken(emailService, email, "verify-email");
    const response = await agent
        .post("/api/v1/auth/verify-email")
        .send({ token });
    return { agent, response, token };
}

/** Logs an existing account in over HTTP and returns the agent holding the session cookies plus the login response. */
export async function loginAs(
    app,
    email,
    password = TEST_PASSWORD,
    { rememberMe, headers = {} } = {}
) {
    const agent = await createAuthAgent(app, { headers });
    const response = await agent
        .post("/api/v1/auth/login")
        .send({ email, password, ...(rememberMe ? { rememberMe: true } : {}) });
    return { agent, response };
}
