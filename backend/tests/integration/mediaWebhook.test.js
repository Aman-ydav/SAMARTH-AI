import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "#config/env.js";
import { assertWebhookSignature } from "#integrations/cloudinary/cloudinary.adapter.js";

vi.mock("cloudinary", async (importOriginal) =>
    (
        await import("#integrations/cloudinary/cloudinary.mock.js")
    ).buildMockedCloudinaryModule(await importOriginal())
);

const sha1 = (text) => createHash("sha1").update(text).digest("hex");

afterEach(() => {
    vi.useRealTimers();
});

describe("assertWebhookSignature (MEDIA-15, R38)", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    const timestamp = Math.floor(now / 1000);
    const rawBody = '{"notification_type":"upload","public_id":"x"}';
    const sign = (body, ts) => sha1(`${body}${ts}${env.cloudinary.apiSecret}`);
    // The SDK helper reads the wall clock for its own staleness check, so pin Date (timers stay real).
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(now);
    });

    it("accepts a correctly signed, fresh notification", () => {
        expect(() =>
            assertWebhookSignature({
                rawBody,
                timestamp,
                signature: sign(rawBody, timestamp),
                now,
            })
        ).not.toThrow();
    });

    it("rejects a bad signature with 400 WEBHOOK_SIGNATURE_INVALID", () => {
        expect(() =>
            assertWebhookSignature({
                rawBody,
                timestamp,
                signature: "0".repeat(40),
                now,
            })
        ).toThrowError(
            expect.objectContaining({
                statusCode: 400,
                code: "WEBHOOK_SIGNATURE_INVALID",
            })
        );
    });

    it("rejects a tampered body", () => {
        expect(() =>
            assertWebhookSignature({
                rawBody: `${rawBody} `,
                timestamp,
                signature: sign(rawBody, timestamp),
                now,
            })
        ).toThrow();
    });

    it("rejects stale timestamps even when the signature is valid (over 2 hours)", () => {
        const old = timestamp - 2 * 3600 - 1;
        expect(() =>
            assertWebhookSignature({
                rawBody,
                timestamp: old,
                signature: sign(rawBody, old),
                now,
            })
        ).toThrow();
    });

    it("rejects missing or malformed inputs", () => {
        for (const input of [
            { timestamp, signature: "x", now },
            { rawBody, signature: "x", now },
            { rawBody, timestamp, now },
            { rawBody, timestamp: "abc", signature: "x", now },
        ]) {
            expect(() => assertWebhookSignature(input)).toThrow();
        }
    });
});
