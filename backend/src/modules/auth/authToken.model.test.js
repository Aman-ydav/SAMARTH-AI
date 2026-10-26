import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { AuthToken } from "./authToken.model.js";

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

let n = 0;
const makeToken = (overrides = {}) => ({
    userId: new mongoose.Types.ObjectId(),
    email: "Owner@Example.TEST",
    type: "emailVerify",
    tokenHash: String((n += 1)).padStart(64, "c"),
    expiresAt: new Date(Date.now() + 3_600_000),
    ...overrides,
});

describe("AuthToken model", () => {
    it("declares a unique token hash and a TTL index with 7 days of grace after expiry", async () => {
        const indexes = Object.fromEntries(
            (await AuthToken.collection.indexes()).map((i) => [i.name, i])
        );
        expect(indexes.authTokens_tokenHash_uq.unique).toBe(true);
        expect(indexes.authTokens_expiresAt_ttl.expireAfterSeconds).toBe(
            604_800
        );
        expect(indexes.authTokens_userId_type_usedAt.key).toEqual({
            userId: 1,
            type: 1,
            usedAt: 1,
        });
    });

    it("has exactly four types and refuses others", async () => {
        expect(AuthToken.schema.path("type").enumValues).toEqual([
            "emailVerify",
            "passwordReset",
            "invite",
            "emailChange",
        ]);
        await expect(
            AuthToken.create(makeToken({ type: "magicLink" }))
        ).rejects.toThrow();
        for (const type of AuthToken.schema.path("type").enumValues) {
            await expect(
                AuthToken.create(makeToken({ type }))
            ).resolves.toBeTruthy();
        }
    });

    it("normalises emails, defaults usedAt to null and needs no user or org (invites, R36)", async () => {
        const token = await AuthToken.create(
            makeToken({ userId: undefined, type: "invite" })
        );
        expect(token.email).toBe("owner@example.test");
        expect(token.usedAt).toBeNull();
        expect(token.userId).toBeUndefined();
        expect(token.orgId).toBeUndefined();
    });

    it("stores the email-change meta with kind confirm or undo only (R8)", async () => {
        const ok = await AuthToken.create(
            makeToken({
                type: "emailChange",
                meta: {
                    kind: "undo",
                    oldEmail: "Old@Example.test",
                    newEmail: "new@example.test",
                },
            })
        );
        expect(ok.meta).toMatchObject({
            kind: "undo",
            oldEmail: "old@example.test",
            newEmail: "new@example.test",
        });
        await expect(
            AuthToken.create(
                makeToken({ type: "emailChange", meta: { kind: "other" } })
            )
        ).rejects.toThrow();
    });

    it("refuses a duplicate hash, a malformed hash, a missing expiry and a bad email", async () => {
        const first = makeToken();
        await AuthToken.create(first);
        await expect(
            AuthToken.create(makeToken({ tokenHash: first.tokenHash }))
        ).rejects.toMatchObject({ code: 11000 });
        await expect(
            AuthToken.create(makeToken({ tokenHash: "short" }))
        ).rejects.toThrow();
        await expect(
            AuthToken.create(makeToken({ expiresAt: undefined }))
        ).rejects.toThrow(/EXPIRES_AT_REQUIRED/);
        await expect(
            AuthToken.create(makeToken({ email: "nope" }))
        ).rejects.toThrow();
    });

    it("hides the token hash unless selected and from toJSON; type is immutable", async () => {
        const created = await AuthToken.create(makeToken());
        expect(
            (await AuthToken.findById(created._id)).tokenHash
        ).toBeUndefined();
        const selected = await AuthToken.findById(created._id).select(
            "+tokenHash"
        );
        expect(selected.tokenHash).toHaveLength(64);
        expect(selected.toJSON()).not.toHaveProperty("tokenHash");
        selected.type = "passwordReset";
        await selected.save();
        expect((await AuthToken.findById(created._id)).type).toBe(
            "emailVerify"
        );
    });
});
