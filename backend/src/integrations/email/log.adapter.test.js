import { describe, expect, it, vi } from "vitest";
import { createLogTransport } from "./log.adapter.js";

describe("log transport", () => {
    it("logs the template, recipient hash and subject, never the body or links (BE-72)", async () => {
        const log = { info: vi.fn() };
        const transport = createLogTransport({ log });
        const result = await transport.send({
            templateKey: "verify-email",
            toHash: "a".repeat(64),
            subject: "Confirm your email",
            to: "asha@example.test",
            html: "<a href='https://app.example.test/x#token=SECRET'>x</a>",
            text: "link https://app.example.test/x#token=SECRET",
            data: { link: "https://app.example.test/x#token=SECRET" },
        });
        expect(transport.name).toBe("log");
        expect(result.messageId).toBeTruthy();
        const logged = JSON.stringify(log.info.mock.calls);
        expect(logged).toContain("verify-email");
        expect(logged).toContain("a".repeat(64));
        expect(logged).not.toContain("SECRET");
        expect(logged).not.toContain("asha@example.test");
        expect(logged).not.toContain("href");
    });

    it("prints the action links labelled DEV ONLY when printLinks is on (R40), still without the body or the address", async () => {
        const log = { info: vi.fn() };
        const transport = createLogTransport({ log, printLinks: true });
        await transport.send({
            templateKey: "verify-email",
            toHash: "a".repeat(64),
            subject: "Confirm your email",
            to: "asha@example.test",
            html: "<p>SECRET-BODY</p>",
            text: "SECRET-BODY",
            data: {
                name: "Asha",
                link: "http://localhost:5173/verify-email#token=abc123",
            },
        });
        const [entry, message] = log.info.mock.calls[0];
        expect(entry.devLinks).toEqual([
            "http://localhost:5173/verify-email#token=abc123",
        ]);
        expect(message).toContain("DEV ONLY");
        const logged = JSON.stringify(log.info.mock.calls);
        expect(logged).not.toContain("SECRET-BODY");
        expect(logged).not.toContain("asha@example.test");
    });

    it("prints no links by default", async () => {
        const log = { info: vi.fn() };
        await createLogTransport({ log }).send({
            templateKey: "x",
            toHash: "b".repeat(64),
            subject: "s",
            data: { link: "http://localhost:5173/a#token=zzz" },
        });
        expect(log.info.mock.calls[0][0]).not.toHaveProperty("devLinks");
        expect(JSON.stringify(log.info.mock.calls)).not.toContain("zzz");
    });
});
