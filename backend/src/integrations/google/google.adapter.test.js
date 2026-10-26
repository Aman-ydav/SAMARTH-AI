import { OAuth2Client } from "google-auth-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGoogleVerifier } from "./google.adapter.js";

vi.mock("google-auth-library", () => ({ OAuth2Client: vi.fn() }));

const CLIENT_ID = "test-client-id.apps.example.test";
const NOW = Date.parse("2026-10-26T10:00:00Z");
const goodPayload = (overrides = {}) => ({
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    sub: "1234567890",
    email: "Ana.Rao@Example.test",
    email_verified: true,
    name: " Ana Rao ",
    exp: NOW / 1000 + 600,
    ...overrides,
});
const fakeClient = (payload, failure) => ({
    verifyIdToken: vi.fn(async () => {
        if (failure) throw failure;
        return { getPayload: () => payload };
    }),
});
const verifierFor = (payload, failure, extra = {}) => {
    const client = fakeClient(payload, failure);
    return {
        client,
        verify: createGoogleVerifier({
            clientId: CLIENT_ID,
            client,
            now: () => NOW,
            ...extra,
        }),
    };
};

beforeEach(() => vi.mocked(OAuth2Client).mockReset());

describe("createGoogleVerifier (AUTH-41, AUTH-42)", () => {
    it("returns only sub, normalised email and name, and asks the library to check the audience", async () => {
        const { client, verify } = verifierFor(goodPayload());
        await expect(verify("credential-value")).resolves.toEqual({
            sub: "1234567890",
            email: "ana.rao@example.test",
            name: "Ana Rao",
        });
        expect(client.verifyIdToken).toHaveBeenCalledWith({
            idToken: "credential-value",
            audience: CLIENT_ID,
        });
    });

    it("accepts both Google issuer spellings", async () => {
        for (const iss of [
            "accounts.google.com",
            "https://accounts.google.com",
        ]) {
            await expect(
                verifierFor(goodPayload({ iss })).verify("c")
            ).resolves.toMatchObject({ sub: "1234567890" });
        }
    });

    it("falls back to the email name when Google sends no name", async () => {
        const { verify } = verifierFor(goodPayload({ name: undefined }));
        expect((await verify("c")).name).toBe("ana.rao");
    });

    it.each([
        ["a wrong audience", { aud: "someone-elses-client" }],
        ["a bad issuer", { iss: "https://evil.example.test" }],
        ["an expired token", { exp: NOW / 1000 - 1 }],
        ["no expiry", { exp: undefined }],
        ["no subject", { sub: "" }],
        ["no email", { email: undefined }],
    ])("rejects %s with GOOGLE_TOKEN_INVALID", async (_label, patch) => {
        await expect(
            verifierFor(goodPayload(patch)).verify("c")
        ).rejects.toMatchObject({
            statusCode: 401,
            code: "GOOGLE_TOKEN_INVALID",
        });
    });

    it("rejects an unverified email with GOOGLE_EMAIL_UNVERIFIED", async () => {
        for (const email_verified of [false, undefined, "true"]) {
            await expect(
                verifierFor(goodPayload({ email_verified })).verify("c")
            ).rejects.toMatchObject({
                statusCode: 401,
                code: "GOOGLE_EMAIL_UNVERIFIED",
            });
        }
    });

    it("checks the nonce only when one was sent", async () => {
        const { verify } = verifierFor(goodPayload({ nonce: "abc" }));
        await expect(verify("c")).resolves.toBeTruthy();
        await expect(verify("c", { nonce: "abc" })).resolves.toBeTruthy();
        await expect(verify("c", { nonce: "other" })).rejects.toMatchObject({
            code: "GOOGLE_TOKEN_INVALID",
        });
        await expect(
            verifierFor(goodPayload()).verify("c", { nonce: "abc" })
        ).rejects.toMatchObject({ code: "GOOGLE_TOKEN_INVALID" });
    });

    it("maps every library failure (bad signature, malformed token) to GOOGLE_TOKEN_INVALID and keeps the cause out of the message", async () => {
        const { verify } = verifierFor(
            undefined,
            new Error("Invalid token signature: secret-detail")
        );
        const error = await verify("c").catch((e) => e);
        expect(error).toMatchObject({
            statusCode: 401,
            code: "GOOGLE_TOKEN_INVALID",
        });
        expect(error.message).not.toContain("secret-detail");
        expect(error.cause.message).toContain("secret-detail");
    });

    it("maps an empty ticket to GOOGLE_TOKEN_INVALID", async () => {
        const client = { verifyIdToken: vi.fn(async () => undefined) };
        const verify = createGoogleVerifier({
            clientId: CLIENT_ID,
            client,
            now: () => NOW,
        });
        await expect(verify("c")).rejects.toMatchObject({
            code: "GOOGLE_TOKEN_INVALID",
        });
    });

    it("maps an unreachable Google to 502 INTEGRATION_ERROR", async () => {
        const network = Object.assign(new Error("getaddrinfo ENOTFOUND"), {
            code: "ENOTFOUND",
        });
        await expect(
            verifierFor(undefined, network).verify("c")
        ).rejects.toMatchObject({
            statusCode: 502,
            code: "INTEGRATION_ERROR",
        });
        const withResponse = Object.assign(new Error("HTTP 503"), {
            response: { status: 503 },
        });
        await expect(
            verifierFor(undefined, withResponse).verify("c")
        ).rejects.toMatchObject({ statusCode: 502 });
    });

    it("gives up after the timeout (fake timers) instead of hanging", async () => {
        vi.useFakeTimers();
        const client = { verifyIdToken: vi.fn(() => new Promise(() => {})) };
        const verify = createGoogleVerifier({
            clientId: CLIENT_ID,
            client,
            timeoutMs: 50,
            now: () => NOW,
        });
        const pending = verify("c").catch((e) => e);
        await vi.advanceTimersByTimeAsync(60);
        expect(await pending).toMatchObject({
            statusCode: 502,
            code: "INTEGRATION_ERROR",
        });
        vi.useRealTimers();
    });

    it("is FORBIDDEN, not a crash, when no client id is configured", async () => {
        const verify = createGoogleVerifier({});
        await expect(verify("c")).rejects.toMatchObject({
            statusCode: 403,
            code: "FORBIDDEN",
        });
        expect(OAuth2Client).not.toHaveBeenCalled();
    });

    it("builds the library client from the client id when none is injected", async () => {
        vi.mocked(OAuth2Client).mockImplementation(function Mock() {
            return fakeClient(goodPayload());
        });
        const verify = createGoogleVerifier({
            clientId: CLIENT_ID,
            now: () => NOW,
        });
        await expect(verify("c")).resolves.toMatchObject({ sub: "1234567890" });
        expect(OAuth2Client).toHaveBeenCalledWith(CLIENT_ID);
    });
});
