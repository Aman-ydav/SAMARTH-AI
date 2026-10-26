import jwt from "jsonwebtoken";
import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "#config/env.js";
import { makeTestEnv } from "#tests/helpers/testEnv.js";
import { signAccessToken, verifyAccessToken } from "./accessToken.js";

const ID = "64b7f0f0f0f0f0f0f0f0f0f1";
const ORG = "000000000000000000000001";
const SID = "64b7f0f0f0f0f0f0f0f0f0f2";
const claims = {
    userId: ID,
    role: "learner",
    orgId: ORG,
    sid: SID,
    tokenVersion: 2,
};

afterEach(() => vi.useRealTimers());

describe("signAccessToken / verifyAccessToken", () => {
    it("round-trips the five claims and nothing else", () => {
        const token = signAccessToken(claims);
        expect(verifyAccessToken(token)).toEqual({
            userId: ID,
            role: "learner",
            orgId: ORG,
            sid: SID,
            tokenVersion: 2,
        });
        const payload = jwt.decode(token);
        expect(Object.keys(payload).sort()).toEqual(
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
    });

    it("signs HS256 and verifies with the pinned algorithm only", () => {
        const token = signAccessToken(claims);
        expect(jwt.decode(token, { complete: true }).header.alg).toBe("HS256");
        const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify(jwt.decode(token))).toString("base64url")}.`;
        expect(() => verifyAccessToken(none)).toThrow();
        const hs512 = jwt.sign(jwt.decode(token), env.auth.accessSecret, {
            algorithm: "HS512",
        });
        expect(() => verifyAccessToken(hs512)).toThrow();
    });

    it("expires after the configured 15 minutes", () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
        const token = signAccessToken(claims);
        vi.setSystemTime(new Date("2026-10-26T10:14:59Z"));
        expect(verifyAccessToken(token).userId).toBe(ID);
        vi.setSystemTime(new Date("2026-10-26T10:15:01Z"));
        expect(() => verifyAccessToken(token)).toThrowError(
            expect.objectContaining({ name: "TokenExpiredError" })
        );
    });

    it("rejects a token signed with another secret, issuer or audience", () => {
        const good = signAccessToken(claims);
        const payload = jwt.decode(good);
        const wrongSecret = jwt.sign(payload, "x".repeat(48), {
            algorithm: "HS256",
        });
        expect(() => verifyAccessToken(wrongSecret)).toThrow(/signature/);
        const { iss: _iss, ...withoutIssuer } = payload;
        const wrongIssuer = jwt.sign(
            { ...withoutIssuer },
            env.auth.accessSecret,
            { issuer: "someone-else" }
        );
        expect(() => verifyAccessToken(wrongIssuer)).toThrow(/issuer/);
        const { aud: _aud, ...withoutAudience } = payload;
        const wrongAudience = jwt.sign(
            { ...withoutAudience },
            env.auth.accessSecret,
            { audience: "other" }
        );
        expect(() => verifyAccessToken(wrongAudience)).toThrow(/audience/);
    });

    it("omits sid for a limited session and returns sid null", () => {
        const token = signAccessToken({ ...claims, sid: undefined });
        expect(jwt.decode(token)).not.toHaveProperty("sid");
        expect(verifyAccessToken(token).sid).toBeNull();
    });

    it.each([
        ["sub", { sub: "not-an-id" }],
        ["orgId", { orgId: "nope" }],
        ["role", { role: "root" }],
        ["tv", { tv: -1 }],
        ["tv type", { tv: "1" }],
        ["sid", { sid: "bad" }],
    ])("answers TOKEN_INVALID for a malformed %s claim", (_name, patch) => {
        const base = jwt.decode(signAccessToken(claims));
        const { sub, ...rest } = patch;
        const forged = jwt.sign(
            {
                role: base.role,
                orgId: base.orgId,
                sid: base.sid,
                tv: base.tv,
                ...rest,
            },
            env.auth.accessSecret,
            {
                algorithm: "HS256",
                issuer: base.iss,
                audience: base.aud,
                subject: sub ?? base.sub,
            }
        );
        expect(() => verifyAccessToken(forged)).toThrowError(
            expect.objectContaining({ statusCode: 401, code: "TOKEN_INVALID" })
        );
    });

    it("uses the config it is given", () => {
        const other = makeTestEnv({ ACCESS_TOKEN_SECRET: "q".repeat(48) });
        const token = signAccessToken(claims, other);
        expect(() => verifyAccessToken(token)).toThrow();
        expect(verifyAccessToken(token, other).userId).toBe(ID);
    });
});
