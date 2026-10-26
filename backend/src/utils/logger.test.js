import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger, logger, REDACT_PATHS } from "./logger.js";

function capture(options = {}) {
    const lines = [];
    const destination = new Writable({
        write(chunk, _encoding, callback) {
            lines.push(JSON.parse(chunk.toString()));
            callback();
        },
    });
    return {
        log: createLogger({ level: "trace", destination, ...options }),
        lines,
    };
}

describe("logger", () => {
    it("is silent in the test environment by default", () => {
        expect(logger.level).toBe("silent");
    });

    it("writes structured lines with ISO time, level label and service name", () => {
        const { log, lines } = capture();
        log.info({ requestId: "r1" }, "hello");
        expect(lines[0]).toMatchObject({
            level: "info",
            msg: "hello",
            requestId: "r1",
            service: "samarth-ai-api",
        });
        expect(new Date(lines[0].time).toISOString()).toBe(lines[0].time);
    });

    it("redacts passwords, tokens, credentials, cookies and API keys at any listed depth", () => {
        const { log, lines } = capture();
        log.info({
            password: "pw-1",
            body: {
                newPassword: "pw-2",
                currentPassword: "pw-3",
                nested: { token: "t-1" },
            },
            credential: "g-1",
            apiKey: "k-1",
            req: {
                headers: {
                    authorization: "Bearer x",
                    cookie: "sai_access=x",
                    "x-csrf-token": "c-1",
                    accept: "json",
                },
            },
            res: {
                headers: { "content-type": "text/plain", "x-any": "value" },
            },
        });
        const text = JSON.stringify(lines[0]);
        for (const secret of [
            "pw-1",
            "pw-2",
            "pw-3",
            "t-1",
            "g-1",
            "k-1",
            "Bearer x",
            "sai_access=x",
            "c-1",
            "text/plain",
        ]) {
            expect(text).not.toContain(secret);
        }
        expect(lines[0].req.headers.accept).toBe("json");
        expect(lines[0].password).toBe("[Redacted]");
    });

    it("lists every key required by AUTH-24", () => {
        for (const key of [
            "password",
            "newPassword",
            "currentPassword",
            "token",
            "credential",
            "authorization",
            "cookie",
        ]) {
            expect(REDACT_PATHS).toContain(key);
        }
    });

    it("respects the configured level", () => {
        const { log, lines } = capture({ level: "warn" });
        log.info("hidden");
        log.warn("shown");
        expect(lines.map((line) => line.msg)).toEqual(["shown"]);
    });
});
