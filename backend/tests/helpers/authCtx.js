import { vi } from "vitest";
import { createEmailService } from "#services/email.service.js";
import { createCookieHelpers } from "#utils/cookies.js";
import { hmacIdentifier } from "#utils/hash.js";
import { makeTestEnv } from "./testEnv.js";

/**
 * A request context for service tests (what `buildRequestContext` produces from a request): config, `mail` backed by a
 * fresh memory outbox, hashed IP and user agent, and a stubbed Google verifier. `ctx.emailService.whenSettled()` waits
 * for queued mail; `ctx.outbox` reads it.
 */
export function makeAuthCtx({
    env: envOverrides = {},
    userAgent = "Vitest Browser/1.0",
    ip = "203.0.113.7",
    ...overrides
} = {}) {
    const config = makeTestEnv(envOverrides);
    const emailService = createEmailService({ config });
    const secret = config.auth.identifierHashSecret;
    return {
        config,
        emailService,
        outbox: emailService.outbox,
        mail: (message) =>
            emailService.enqueueEmail(message, { requestId: "req-test" }),
        cookies: createCookieHelpers(config),
        requestId: "req-test",
        ipHash: hmacIdentifier(ip, secret),
        userAgent,
        userAgentHash: hmacIdentifier(userAgent, secret),
        verifyGoogleCredential: vi.fn(),
        log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
        ...overrides,
    };
}

/** The same context seen from another browser (different user agent, same config and outbox). */
export function fromOtherDevice(ctx, userAgent) {
    const secret = ctx.config.auth.identifierHashSecret;
    return {
        ...ctx,
        userAgent,
        userAgentHash: hmacIdentifier(userAgent, secret),
    };
}
