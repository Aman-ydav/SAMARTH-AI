import { describe, expect, it, vi } from "vitest";
import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { ApiError } from "#utils/apiError.js";
import { hmacIdentifier } from "#utils/hash.js";
import { makeTestEnv } from "#tests/helpers/testEnv.js";
import { buildFrontendLink } from "#integrations/email/emailLinks.mapper.js";
import { createMemoryTransport } from "#integrations/email/memory.adapter.js";
import {
    createEmailService,
    emailService,
    enqueueEmail,
    sendEmail,
} from "./email.service.js";

const quietLog = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });
const verifyMessage = (overrides = {}) => ({
    to: "Asha@Example.test",
    templateKey: EMAIL_TEMPLATES.VERIFY_EMAIL,
    data: {
        name: "Asha",
        link: buildFrontendLink("/verify-email", { token: "tok-123" }),
        expiresIn: "24 hours",
    },
    ...overrides,
});
const makeService = (extra = {}) => {
    const transport = extra.transport ?? createMemoryTransport();
    const log = quietLog();
    return {
        transport,
        log,
        service: createEmailService({
            config: makeTestEnv(),
            log,
            transport,
            retryDelaysMs: [0, 0, 0],
            ...extra,
        }),
    };
};

describe("sendEmail", () => {
    it("renders the template and delivers it through the transport with a normalised recipient", async () => {
        const { service, transport } = makeService();
        const result = await service.sendEmail(verifyMessage());
        expect(result).toMatchObject({ transport: "memory" });
        const [mail] = transport.all();
        expect(mail).toMatchObject({
            to: "asha@example.test",
            templateKey: "verify-email",
            subject: "Confirm your email for SAMARTH AI",
            lang: "en",
        });
        expect(mail.toHash).toBe(hmacIdentifier("asha@example.test"));
        expect(mail.text).toContain(
            "http://localhost:5173/verify-email#token=tok-123"
        );
    });

    it("builds links from FRONTEND_URL, never from request data (AUTH-31)", async () => {
        const { service, transport } = makeService();
        await expect(
            service.sendEmail(
                verifyMessage({
                    data: {
                        name: "A",
                        link: "https://evil.example/verify-email#token=t",
                        expiresIn: "1h",
                    },
                })
            )
        ).rejects.toThrow(/FRONTEND_URL/);
        expect(transport.all()).toEqual([]);
    });

    it.each([
        "not-an-email",
        "",
        undefined,
        "a@b",
        `${"x".repeat(250)}@example.test`,
    ])("rejects the invalid recipient %j", async (to) => {
        const { service, transport } = makeService();
        await expect(
            service.sendEmail(verifyMessage({ to }))
        ).rejects.toMatchObject({ isOperational: false });
        expect(transport.all()).toEqual([]);
    });

    it("propagates transport failures to the caller (not swallowed)", async () => {
        const failing = {
            name: "memory",
            send: vi.fn().mockRejectedValue(ApiError.badGateway()),
        };
        const { service } = makeService({ transport: failing });
        await expect(service.sendEmail(verifyMessage())).rejects.toMatchObject({
            code: "INTEGRATION_ERROR",
        });
    });

    it("counts deliveries", async () => {
        const { service } = makeService();
        await service.sendEmail(verifyMessage());
        expect(service.getStats()).toEqual({ sent: 1, failed: 0 });
    });
});

describe("enqueueEmail (BE-73)", () => {
    it("returns immediately and delivers after the caller has continued", async () => {
        const { service, transport } = makeService();
        const returned = service.enqueueEmail(verifyMessage());
        expect(returned).toBeUndefined();
        expect(transport.all()).toHaveLength(0);
        await service.whenSettled();
        expect(transport.all()).toHaveLength(1);
    });

    it("retries transient provider failures with backoff and then succeeds", async () => {
        const send = vi
            .fn()
            .mockRejectedValueOnce(ApiError.badGateway())
            .mockRejectedValueOnce(ApiError.badGateway())
            .mockResolvedValue({ messageId: "m1" });
        const sleep = vi.fn().mockResolvedValue(undefined);
        const { service } = makeService({
            transport: { name: "brevo", send },
            sleep,
            retryDelaysMs: [10, 50, 250],
        });
        service.enqueueEmail(verifyMessage());
        await service.whenSettled();
        expect(send).toHaveBeenCalledTimes(3);
        expect(sleep.mock.calls).toEqual([[10], [50]]);
        expect(service.getFailures()).toEqual([]);
        expect(service.getStats().sent).toBe(1);
    });

    it("records a final failure with the recipient hash only and logs it with the request id (BE-72)", async () => {
        const send = vi.fn().mockRejectedValue(ApiError.badGateway());
        const { service, log } = makeService({
            transport: { name: "brevo", send },
        });
        service.enqueueEmail(verifyMessage(), { requestId: "req-1234" });
        await service.whenSettled();
        expect(send).toHaveBeenCalledTimes(4);
        const [failure] = service.getFailures();
        expect(failure).toMatchObject({
            templateKey: "verify-email",
            requestId: "req-1234",
            attempts: 4,
            code: "INTEGRATION_ERROR",
            recipient: hmacIdentifier("asha@example.test"),
        });
        expect(JSON.stringify(failure)).not.toContain("example.test");
        expect(log.error).toHaveBeenCalledTimes(1);
        const logged = JSON.stringify(log.error.mock.calls[0][0]);
        expect(logged).toContain("req-1234");
        expect(logged).not.toContain("tok-123");
        expect(logged).not.toContain("asha@example.test");
        expect(service.getStats().failed).toBe(1);
    });

    it("does not retry programmer errors such as an unknown template", async () => {
        const { service, transport } = makeService();
        service.enqueueEmail(verifyMessage({ templateKey: "nope" }));
        await service.whenSettled();
        expect(transport.all()).toEqual([]);
        expect(service.getFailures()).toHaveLength(1);
        expect(service.getFailures()[0]).toMatchObject({
            attempts: 1,
            code: "INTERNAL",
        });
    });

    it("never rejects into the caller, even when the failure log itself would be noisy", async () => {
        const { service } = makeService({
            transport: {
                name: "brevo",
                send: vi.fn().mockRejectedValue(new Error("raw boom")),
            },
        });
        expect(() => service.enqueueEmail(verifyMessage())).not.toThrow();
        await expect(service.whenSettled()).resolves.toBeUndefined();
        expect(service.getFailures()[0].code).toBe("INTERNAL");
    });

    it("caps recorded failures at 50", async () => {
        const { service } = makeService({
            transport: {
                name: "brevo",
                send: vi.fn().mockRejectedValue(ApiError.badGateway()),
            },
            retryDelaysMs: [],
        });
        for (let i = 0; i < 55; i += 1) service.enqueueEmail(verifyMessage());
        await service.whenSettled();
        expect(service.getFailures()).toHaveLength(50);
    });

    it("handles many concurrent sends", async () => {
        const { service, transport } = makeService();
        for (let i = 0; i < 20; i += 1)
            service.enqueueEmail(
                verifyMessage({ to: `user${i}@example.test` })
            );
        await service.whenSettled();
        expect(transport.all()).toHaveLength(20);
    });
});

describe("transport selection (EMAIL_TRANSPORT)", () => {
    it("uses the memory transport in the test environment and exposes its outbox", () => {
        const service = createEmailService({
            config: makeTestEnv(),
            log: quietLog(),
        });
        expect(service.transportName).toBe("memory");
        expect(service.outbox).toBeDefined();
    });

    it("uses the log transport in development and has no outbox", async () => {
        const log = quietLog();
        const service = createEmailService({
            config: makeTestEnv({ NODE_ENV: "development" }),
            log,
        });
        expect(service.transportName).toBe("log");
        expect(service.outbox).toBeUndefined();
        await service.sendEmail(
            verifyMessage({
                data: {
                    name: "A",
                    link: buildFrontendLink(
                        "/verify-email",
                        { token: "SECRET" },
                        "http://localhost:5173"
                    ),
                    expiresIn: "1h",
                },
            })
        );
        // R40: in development the action link is printed so developers can click it, labelled DEV ONLY.
        const logged = JSON.stringify(log.info.mock.calls);
        expect(logged).toContain("DEV ONLY");
        expect(logged).toContain("verify-email#token=SECRET");
        expect(logged).not.toContain("asha@example.test");
    });

    it("never prints links with the log transport outside development (R40)", async () => {
        for (const overrides of [
            { NODE_ENV: "production", EMAIL_TRANSPORT: "log" },
        ]) {
            const log = quietLog();
            const service = createEmailService({
                config: makeTestEnv(overrides),
                log,
            });
            expect(service.transportName).toBe("log");
            await service.sendEmail(
                verifyMessage({
                    data: {
                        name: "A",
                        link: buildFrontendLink(
                            "/verify-email",
                            { token: "SECRET" },
                            "https://app.example.test"
                        ),
                        expiresIn: "1h",
                    },
                })
            );
            expect(JSON.stringify(log.info.mock.calls)).not.toContain("SECRET");
            expect(JSON.stringify(log.info.mock.calls)).not.toContain(
                "DEV ONLY"
            );
        }
    });

    it("selects the Brevo transport when configured", () => {
        const config = makeTestEnv({
            NODE_ENV: "production",
            EMAIL_TRANSPORT: "brevo",
            BREVO_API_KEY: "placeholder",
            EMAIL_FROM_ADDRESS: "no-reply@example.test",
        });
        expect(
            createEmailService({ config, log: quietLog() }).transportName
        ).toBe("brevo");
    });
});

describe("default instance", () => {
    it("exports bound sendEmail and enqueueEmail that use the memory outbox in tests", async () => {
        emailService.outbox.clear();
        enqueueEmail(verifyMessage({ to: "default@example.test" }));
        await emailService.whenSettled();
        expect(
            emailService.outbox.latest({ to: "default@example.test" })
        ).toBeDefined();
        await sendEmail(verifyMessage({ to: "second@example.test" }));
        expect(
            emailService.outbox.find({ templateKey: "verify-email" })
        ).toHaveLength(2);
        emailService.outbox.clear();
    });
});
