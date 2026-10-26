import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { env } from "#config/env.js";
import { AUTH_TOKEN_TTL_MS, AUTH_TOKEN_TYPES } from "#constants/tokenTypes.js";
import { sha256Hex } from "#utils/hash.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { AuthToken } from "./authToken.model.js";
import {
    consumeEmailToken,
    countIssuedSince,
    createAccessToken,
    generateCsrfToken,
    generateRefreshToken,
    hashRefreshToken,
    issueEmailToken,
    lastIssuedAt,
    peekEmailToken,
    supersedeEmailTokens,
} from "./tokens.service.js";

const userId = new mongoose.Types.ObjectId();
const orgId = new mongoose.Types.ObjectId();
const user = { _id: userId, role: "learner", orgId, tokenVersion: 3 };

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

describe("access token", () => {
    it("is HS256 with only sub, role, orgId, sid, tv, iss, aud, exp and a 15 minute life", () => {
        const sid = new mongoose.Types.ObjectId().toHexString();
        const claims = jwt.decode(createAccessToken(user, sid), {
            complete: true,
        });
        expect(claims.header.alg).toBe("HS256");
        expect(Object.keys(claims.payload).sort()).toEqual(
            [
                "aud",
                "exp",
                "iat",
                "iss",
                "orgId",
                "role",
                "sid",
                "sub",
                "tv",
            ].sort()
        );
        expect(claims.payload).toMatchObject({
            sub: String(userId),
            tv: 3,
            sid,
        });
        expect(claims.payload.exp - claims.payload.iat).toBe(900);
    });

    it("omits sid for a limited session", () => {
        expect(jwt.decode(createAccessToken(user, null))).not.toHaveProperty(
            "sid"
        );
    });
});

describe("refresh and csrf tokens", () => {
    it("creates 32 random bytes and stores only the keyed hash", () => {
        const first = generateRefreshToken();
        const second = generateRefreshToken();
        expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(first.token).not.toBe(second.token);
        expect(first.tokenHash).toMatch(/^[a-f0-9]{64}$/);
        expect(first.tokenHash).toBe(hashRefreshToken(first.token));
        expect(first.tokenHash).not.toBe(sha256Hex(first.token));
    });

    it("hashes with the configured REFRESH_TOKEN_SECRET", () => {
        const other = { auth: { refreshSecret: "x".repeat(40) } };
        expect(hashRefreshToken("abc", other)).not.toBe(
            hashRefreshToken("abc", env)
        );
    });

    it("generates distinct csrf values", () => {
        expect(generateCsrfToken()).not.toBe(generateCsrfToken());
    });
});

describe("one-time email tokens", () => {
    const issue = (overrides = {}) =>
        issueEmailToken({
            type: AUTH_TOKEN_TYPES.EMAIL_VERIFY,
            userId,
            email: "learner@example.test",
            ctx: { ipHash: "a".repeat(64), userAgent: "Vitest" },
            ...overrides,
        });

    it("stores only the SHA-256 hash, bound to user and email, with the type's TTL", async () => {
        const now = new Date("2026-10-26T10:00:00Z");
        const { token, record } = await issueEmailToken(
            {
                type: AUTH_TOKEN_TYPES.PASSWORD_RESET,
                userId,
                email: "learner@example.test",
            },
            { now }
        );
        const stored = await AuthToken.findById(record._id)
            .select("+tokenHash")
            .lean();
        expect(stored.tokenHash).toBe(sha256Hex(token));
        expect(JSON.stringify(stored)).not.toContain(token);
        expect(stored.expiresAt.getTime() - now.getTime()).toBe(
            AUTH_TOKEN_TTL_MS[AUTH_TOKEN_TYPES.PASSWORD_RESET]
        );
        expect(AUTH_TOKEN_TTL_MS[AUTH_TOKEN_TYPES.PASSWORD_RESET]).toBe(
            30 * 60_000
        );
    });

    it("records the hashed ip and truncated user agent", async () => {
        const { record } = await issue();
        expect(record.createdIpHash).toBe("a".repeat(64));
        expect(record.createdUserAgent).toBe("Vitest");
    });

    it("consumes once: the second use fails", async () => {
        const { token } = await issue();
        const first = await consumeEmailToken({
            token,
            type: AUTH_TOKEN_TYPES.EMAIL_VERIFY,
        });
        expect(first.usedAt).toBeInstanceOf(Date);
        expect(String(first.userId)).toBe(String(userId));
        await expect(
            consumeEmailToken({ token, type: AUTH_TOKEN_TYPES.EMAIL_VERIFY })
        ).resolves.toBeNull();
    });

    it("lets exactly one of two concurrent consumers win", async () => {
        const { token } = await issue();
        const results = await Promise.all([
            consumeEmailToken({ token, type: AUTH_TOKEN_TYPES.EMAIL_VERIFY }),
            consumeEmailToken({ token, type: AUTH_TOKEN_TYPES.EMAIL_VERIFY }),
        ]);
        expect(results.filter(Boolean)).toHaveLength(1);
    });

    it("rejects the wrong type, unknown and malformed tokens the same way", async () => {
        const { token } = await issue();
        for (const bad of ["", "nope", "x".repeat(500), token + "x"]) {
            await expect(
                consumeEmailToken({
                    token: bad,
                    type: AUTH_TOKEN_TYPES.EMAIL_VERIFY,
                })
            ).resolves.toBeNull();
        }
        await expect(
            consumeEmailToken({ token, type: AUTH_TOKEN_TYPES.PASSWORD_RESET })
        ).resolves.toBeNull();
    });

    it("rejects an expired token (fake clock)", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
        const { token } = await issue({
            type: AUTH_TOKEN_TYPES.PASSWORD_RESET,
        });
        vi.setSystemTime(new Date("2026-10-26T10:29:59Z"));
        await expect(
            peekEmailToken({ token, type: AUTH_TOKEN_TYPES.PASSWORD_RESET })
        ).resolves.toBeTruthy();
        vi.setSystemTime(new Date("2026-10-26T10:30:01Z"));
        await expect(
            peekEmailToken({ token, type: AUTH_TOKEN_TYPES.PASSWORD_RESET })
        ).resolves.toBeNull();
        await expect(
            consumeEmailToken({ token, type: AUTH_TOKEN_TYPES.PASSWORD_RESET })
        ).resolves.toBeNull();
    });

    it("peek does not consume", async () => {
        const { token } = await issue();
        await peekEmailToken({ token, type: AUTH_TOKEN_TYPES.EMAIL_VERIFY });
        await expect(
            consumeEmailToken({ token, type: AUTH_TOKEN_TYPES.EMAIL_VERIFY })
        ).resolves.toBeTruthy();
    });

    it("a newer token of the same type invalidates the older ones", async () => {
        const older = await issue();
        const newer = await issue();
        await expect(
            consumeEmailToken({
                token: older.token,
                type: AUTH_TOKEN_TYPES.EMAIL_VERIFY,
            })
        ).resolves.toBeNull();
        await expect(
            consumeEmailToken({
                token: newer.token,
                type: AUTH_TOKEN_TYPES.EMAIL_VERIFY,
            })
        ).resolves.toBeTruthy();
    });

    it("does not invalidate tokens of another type or another user", async () => {
        const reset = await issue({ type: AUTH_TOKEN_TYPES.PASSWORD_RESET });
        const other = await issue({ userId: new mongoose.Types.ObjectId() });
        await issue();
        expect(
            await peekEmailToken({
                token: reset.token,
                type: AUTH_TOKEN_TYPES.PASSWORD_RESET,
            })
        ).toBeTruthy();
        expect(
            await peekEmailToken({
                token: other.token,
                type: AUTH_TOKEN_TYPES.EMAIL_VERIFY,
            })
        ).toBeTruthy();
    });

    it("supersedes email-change tokens per kind only", async () => {
        const type = AUTH_TOKEN_TYPES.EMAIL_CHANGE;
        const confirm = await issue({
            type,
            meta: { kind: "confirm", newEmail: "n@example.test" },
        });
        const undo = await issue({
            type,
            meta: { kind: "undo", oldEmail: "o@example.test" },
        });
        await issue({
            type,
            meta: { kind: "undo", oldEmail: "o@example.test" },
        });
        expect(
            await peekEmailToken({
                token: confirm.token,
                type,
                kind: "confirm",
            })
        ).toBeTruthy();
        expect(
            await peekEmailToken({ token: undo.token, type, kind: "undo" })
        ).toBeNull();
        expect(
            await peekEmailToken({ token: confirm.token, type, kind: "undo" })
        ).toBeNull();
    });

    it("can skip superseding (invites have no user)", async () => {
        const one = await issueEmailToken({
            type: AUTH_TOKEN_TYPES.INVITE,
            email: "a@example.test",
            supersede: false,
        });
        const two = await issueEmailToken({
            type: AUTH_TOKEN_TYPES.INVITE,
            email: "b@example.test",
            supersede: false,
        });
        expect(
            await peekEmailToken({
                token: one.token,
                type: AUTH_TOKEN_TYPES.INVITE,
            })
        ).toBeTruthy();
        expect(
            await peekEmailToken({
                token: two.token,
                type: AUTH_TOKEN_TYPES.INVITE,
            })
        ).toBeTruthy();
    });

    it("counts recent tokens and reports the newest issue time", async () => {
        const type = AUTH_TOKEN_TYPES.EMAIL_VERIFY;
        expect(await lastIssuedAt({ userId, type })).toBeNull();
        await issue();
        await issue();
        expect(
            await countIssuedSince(
                { userId, type },
                new Date(Date.now() - 60_000)
            )
        ).toBe(2);
        expect(
            await countIssuedSince(
                { userId, type },
                new Date(Date.now() + 60_000)
            )
        ).toBe(0);
        expect(
            (await lastIssuedAt({ userId, type })).getTime()
        ).toBeLessThanOrEqual(Date.now());
    });

    it("supersedeEmailTokens reports how many were invalidated", async () => {
        await issue();
        const result = await supersedeEmailTokens({
            userId,
            type: AUTH_TOKEN_TYPES.EMAIL_VERIFY,
        });
        expect(result.modifiedCount).toBe(1);
    });
});
