import { describe, expect, it } from "vitest";
import {
    buildApp,
    createCsrfAgent,
    request,
} from "#tests/helpers/appFactory.js";
import { expectError, expectSuccess } from "#tests/helpers/envelopes.js";
import { buildFrontendLink } from "#integrations/email/emailLinks.mapper.js";
import { shouldMountTestOutbox, TEST_OUTBOX_PATH } from "./testOutbox.js";

const OUTBOX = "/api/v1/__test__/outbox";
const mail = (to, token = "tok-1") => ({
    to,
    templateKey: "verify-email",
    data: {
        name: "Asha",
        link: buildFrontendLink("/verify-email", { token }),
        expiresIn: "24 hours",
    },
});

describe("test-only outbox is present only for NODE_ENV=test AND EMAIL_TRANSPORT=memory (TEST-42)", () => {
    it("serves sent emails with the one-time token in the test environment", async () => {
        const { app, emailService } = buildApp();
        await emailService.sendEmail(mail("asha@example.test"));
        const body = expectSuccess(await request(app).get(OUTBOX), 200);
        expect(body.data.emails).toHaveLength(1);
        expect(body.data.emails[0]).toMatchObject({
            to: "asha@example.test",
            templateKey: "verify-email",
            token: "tok-1",
            subject: "Confirm your email for SAMARTH AI",
        });
        expect(body.data.emails[0].links[0]).toBe(
            "http://localhost:5173/verify-email#token=tok-1"
        );
        expect(body.data.emails[0]).not.toHaveProperty("html");
    });

    it("filters by recipient and template", async () => {
        const { app, emailService } = buildApp();
        await emailService.sendEmail(mail("a@example.test", "ta"));
        await emailService.sendEmail(mail("b@example.test", "tb"));
        const body = (
            await request(app).get(
                `${OUTBOX}?to=b@example.test&templateKey=verify-email`
            )
        ).body;
        expect(body.data.emails.map((e) => e.token)).toEqual(["tb"]);
    });

    it("rejects unknown query keys", async () => {
        expectError(
            await request(buildApp().app).get(`${OUTBOX}?bogus=1`),
            400,
            "VALIDATION_ERROR"
        );
    });

    it("clears the outbox with DELETE (CSRF still applies)", async () => {
        const { app, emailService } = buildApp();
        await emailService.sendEmail(mail("a@example.test"));
        const csrf = await createCsrfAgent(app);
        expectError(await csrf.agent.delete(OUTBOX), 403, "CSRF_INVALID");
        const cleared = expectSuccess(await csrf.delete(OUTBOX), 200);
        expect(cleared.data.cleared).toBe(1);
        expect((await request(app).get(OUTBOX)).body.data.emails).toEqual([]);
    });

    it.each([
        ["development", { NODE_ENV: "development" }],
        ["production", { NODE_ENV: "production" }],
        [
            "test with the log transport",
            { NODE_ENV: "test", EMAIL_TRANSPORT: "log" },
        ],
        [
            "development with explicit log transport",
            { NODE_ENV: "development", EMAIL_TRANSPORT: "log" },
        ],
    ])("answers 404 in %s", async (_label, env) => {
        const { app } = buildApp({ env });
        expectError(await request(app).get(OUTBOX), 404, "NOT_FOUND");
        expectError(await request(app).delete(OUTBOX), 403, "CSRF_INVALID");
    });

    it("is mounted under the API prefix and answers 404 under any other prefix", async () => {
        expect(OUTBOX).toBe(`/api/v1${TEST_OUTBOX_PATH}`);
        expectError(
            await request(buildApp().app).get(TEST_OUTBOX_PATH),
            404,
            "NOT_FOUND"
        );
    });

    it("shouldMountTestOutbox needs both conditions", () => {
        expect(
            shouldMountTestOutbox({
                nodeEnv: "test",
                email: { transport: "memory" },
            })
        ).toBe(true);
        expect(
            shouldMountTestOutbox({
                nodeEnv: "test",
                email: { transport: "log" },
            })
        ).toBe(false);
        expect(
            shouldMountTestOutbox({
                nodeEnv: "development",
                email: { transport: "memory" },
            })
        ).toBe(false);
        expect(
            shouldMountTestOutbox({
                nodeEnv: "production",
                email: { transport: "memory" },
            })
        ).toBe(false);
    });
});
