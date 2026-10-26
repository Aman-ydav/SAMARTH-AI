import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { buildFrontendLink } from "#integrations/email/emailLinks.mapper.js";
import { createMemoryTransport } from "#integrations/email/memory.adapter.js";
import { validate } from "#middlewares/validate.js";
import { createEmailService } from "#services/email.service.js";
import { ApiResponse } from "#utils/apiResponse.js";
import { randomToken } from "#utils/hash.js";
import { makeEmailMessage } from "#tests/factories/emailMessage.factory.js";
import {
    buildApp,
    createCsrfAgent,
    request,
} from "#tests/helpers/appFactory.js";
import { expectSuccess } from "#tests/helpers/envelopes.js";
import { latestToken, sentTo } from "#tests/helpers/outbox.js";
import { makeTestEnv } from "#tests/helpers/testEnv.js";

/**
 * Shows the pattern the auth module follows: validate -> respond neutrally -> enqueue mail after the response ->
 * the test reads the one-time token from the memory outbox (TEST-24, TEST-38).
 */
function demoRoutes(emailService) {
    return (api) => {
        api.post(
            "/demo/signup",
            validate({ body: z.object({ email: z.email() }) }),
            (req, res) => {
                const token = randomToken();
                emailService.enqueueEmail(
                    {
                        to: req.validated.body.email,
                        templateKey: EMAIL_TEMPLATES.VERIFY_EMAIL,
                        data: {
                            name: "Learner",
                            expiresIn: "24 hours",
                            link: buildFrontendLink("/verify-email", { token }),
                        },
                    },
                    { requestId: req.id }
                );
                ApiResponse.accepted(null, "Check your inbox").send(res);
            }
        );
    };
}

describe("signup-style flow with the email outbox", () => {
    it("responds 202 immediately, delivers after the response and exposes the token to tests", async () => {
        const config = makeTestEnv();
        const emailService = createEmailService({ config });
        const { app } = buildApp({
            emailService,
            mountRoutes: demoRoutes(emailService),
        });
        const csrf = await createCsrfAgent(app);

        const res = await csrf
            .post("/api/v1/demo/signup")
            .send({ email: "new.learner@example.test" });
        expectSuccess(res, 202);

        await emailService.whenSettled();
        const [mail] = sentTo(
            emailService,
            "new.learner@example.test",
            EMAIL_TEMPLATES.VERIFY_EMAIL
        );
        expect(mail.subject).toBe("Confirm your email for SAMARTH AI");
        const token = latestToken(
            emailService,
            "new.learner@example.test",
            EMAIL_TEMPLATES.VERIFY_EMAIL
        );
        expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(mail.text).toContain(`/verify-email#token=${token}`);

        const viaHttp = await request(app).get("/api/v1/__test__/outbox");
        expect(viaHttp.body.data.emails[0].token).toBe(token);
    });

    it("does not make the request wait for a slow mail provider (BE-73)", async () => {
        let release;
        const gate = new Promise((resolve) => {
            release = resolve;
        });
        const slow = createMemoryTransport();
        const originalSend = slow.send.bind(slow);
        slow.send = async (message) => {
            await gate;
            return originalSend(message);
        };
        const emailService = createEmailService({
            config: makeTestEnv(),
            transport: slow,
        });
        const { app } = buildApp({
            emailService,
            mountRoutes: demoRoutes(emailService),
        });
        const csrf = await createCsrfAgent(app);

        const res = await csrf
            .post("/api/v1/demo/signup")
            .send({ email: "slow@example.test" });
        expect(res.status).toBe(202);
        expect(slow.all()).toHaveLength(0);

        release();
        await emailService.whenSettled();
        expect(slow.all()).toHaveLength(1);
    });

    it("a provider outage never changes the response and is recorded with the request id", async () => {
        const emailService = createEmailService({
            config: makeTestEnv(),
            transport: {
                name: "brevo",
                send: async () => {
                    throw new Error("provider down");
                },
            },
            retryDelaysMs: [],
        });
        const { app } = buildApp({
            emailService,
            mountRoutes: demoRoutes(emailService),
        });
        const csrf = await createCsrfAgent(app);

        const res = await csrf
            .post("/api/v1/demo/signup")
            .send({ email: "down@example.test" });
        expect(res.status).toBe(202);
        await emailService.whenSettled();
        const [failure] = emailService.getFailures();
        expect(failure.requestId).toBe(res.headers["x-request-id"]);
        expect(JSON.stringify(failure)).not.toContain("down@example.test");
    });

    it("the factory builds messages the service accepts", async () => {
        const emailService = createEmailService({ config: makeTestEnv() });
        const message = makeEmailMessage({ token: "factory-token" });
        await emailService.sendEmail(message);
        expect(latestToken(emailService, message.to, message.templateKey)).toBe(
            "factory-token"
        );
    });
});
