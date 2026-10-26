import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBrevoTransport } from "./brevo.adapter.js";
import { brevoFake } from "./brevo.mock.js";

vi.mock("@getbrevo/brevo", async () =>
    (await import("#integrations/email/brevo.mock.js")).buildMockedBrevoModule()
);

const config = {
    apiKey: "placeholder-key",
    fromAddress: "no-reply@example.test",
    fromName: "SAMARTH AI",
};
const message = {
    to: "asha@example.test",
    subject: "Subject",
    html: "<p>Hi</p>",
    text: "Hi",
    templateKey: "verify-email",
};

beforeEach(() => {
    brevoFake.reset();
});

describe("brevo transport", () => {
    it("sends through the SDK with the configured sender and returns the message id", async () => {
        const transport = createBrevoTransport(config);
        const result = await transport.send(message);
        expect(transport.name).toBe("brevo");
        expect(result.messageId).toBe("<fake-message-id@example.test>");
        expect(brevoFake.clients[0]).toEqual({ apiKey: "placeholder-key" });
        expect(brevoFake.sent[0].request).toEqual({
            sender: { email: "no-reply@example.test", name: "SAMARTH AI" },
            to: [{ email: "asha@example.test" }],
            subject: "Subject",
            htmlContent: "<p>Hi</p>",
            textContent: "Hi",
            tags: ["verify-email"],
        });
    });

    it("sets a timeout and disables SDK retries (the email queue owns retries)", async () => {
        await createBrevoTransport(config).send(message);
        expect(brevoFake.sent[0].requestOptions).toEqual({
            timeoutInSeconds: 15,
            maxRetries: 0,
        });
    });

    it("adds reply-to only when configured", async () => {
        await createBrevoTransport({
            ...config,
            replyTo: "help@example.test",
        }).send(message);
        expect(brevoFake.sent[0].request.replyTo).toEqual({
            email: "help@example.test",
        });
    });

    it("wraps provider failures as 502 INTEGRATION_ERROR and keeps the cause", async () => {
        brevoFake.error = Object.assign(
            new Error("401 Unauthorized: bad key"),
            { statusCode: 401 }
        );
        const failure = await createBrevoTransport(config)
            .send(message)
            .catch((error) => error);
        expect(failure).toMatchObject({
            statusCode: 502,
            code: "INTEGRATION_ERROR",
        });
        expect(failure.message).not.toContain("bad key");
        expect(failure.cause).toBe(brevoFake.error);
    });

    it("returns a null message id when the provider omits it", async () => {
        brevoFake.response = {};
        await expect(
            createBrevoTransport(config).send(message)
        ).resolves.toEqual({ messageId: null });
    });
});
