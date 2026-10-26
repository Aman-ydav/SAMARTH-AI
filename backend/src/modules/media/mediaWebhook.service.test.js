import { createHash } from "node:crypto";
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
import { cloudinaryFake } from "#integrations/cloudinary/cloudinary.mock.js";
import {
    makeMediaAttrs,
    makePendingAttrs,
} from "#tests/factories/media.factory.js";
import {
    clearCollections,
    startTestDb,
    stopTestDb,
} from "#tests/helpers/testDb.js";
import { Media } from "./media.model.js";
import { handleMediaWebhook } from "./mediaWebhook.service.js";

vi.mock("cloudinary", async (importOriginal) =>
    (
        await import("#integrations/cloudinary/cloudinary.mock.js")
    ).buildMockedCloudinaryModule(await importOriginal())
);

const NOW = new Date("2026-10-26T10:00:00.000Z");
const seconds = Math.floor(NOW.getTime() / 1000);
const sha1 = (text) => createHash("sha1").update(text).digest("hex");
const withDeleted = (filter) =>
    Media.findOne(filter).setOptions({ withDeleted: true });

/** Signed delivery exactly as Cloudinary sends it: sha1(rawBody + timestamp + apiSecret). */
function deliver(payload, { timestamp = seconds, tamper, signature } = {}) {
    const rawBody = JSON.stringify(payload);
    return handleMediaWebhook({
        rawBody: tamper ? `${rawBody} ` : rawBody,
        timestamp: String(timestamp),
        signature:
            signature ??
            sha1(`${rawBody}${timestamp}${env.cloudinary.apiSecret}`),
        now: NOW,
    });
}
const uploadNote = (record, extra = {}) => ({
    notification_type: "upload",
    public_id: record.publicId,
    version: 1700000009,
    bytes: 4096,
    format: "mp4",
    ...extra,
});

describe("mediaWebhook.service (MEDIA-15, EDGE-53)", () => {
    beforeAll(async () => {
        await startTestDb();
        await Media.init();
    });
    afterAll(stopTestDb);
    beforeEach(async () => {
        await clearCollections();
        cloudinaryFake.reset();
        // The SDK checks freshness against the wall clock: pin Date only, timers stay real.
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(NOW);
    });

    describe("signature", () => {
        it.each([
            ["a wrong signature", { signature: "0".repeat(40) }],
            ["a tampered body", { tamper: true }],
            ["a stale timestamp (over 2 hours)", { timestamp: seconds - 7201 }],
            [
                "a future timestamp (over 2 hours)",
                { timestamp: seconds + 7201 },
            ],
        ])(
            "rejects %s with 400 WEBHOOK_SIGNATURE_INVALID and processes nothing",
            async (_label, options) => {
                const record = await Media.create(makeMediaAttrs());
                await expect(
                    deliver(uploadNote(record), options)
                ).rejects.toMatchObject({
                    statusCode: 400,
                    code: "WEBHOOK_SIGNATURE_INVALID",
                });
                expect((await Media.findById(record._id)).version).toBe(
                    1700000001
                );
            }
        );

        it("rejects missing headers and a missing raw body", async () => {
            for (const input of [
                { rawBody: "{}" },
                { rawBody: "{}", timestamp: String(seconds) },
                { timestamp: String(seconds), signature: "x" },
            ])
                await expect(
                    handleMediaWebhook({ ...input, now: NOW })
                ).rejects.toMatchObject({ code: "WEBHOOK_SIGNATURE_INVALID" });
        });
    });

    describe("upload notifications", () => {
        it("refreshes the facts of a confirmed asset when a newer version arrives", async () => {
            const record = await Media.create(makeMediaAttrs());
            const result = await deliver(
                uploadNote(record, { width: 640, height: 360 })
            );
            expect(result).toEqual({ received: true, action: "reconciled" });
            expect(await Media.findById(record._id)).toMatchObject({
                version: 1700000009,
                bytes: 4096,
                width: 640,
                height: 360,
                status: "ready",
            });
        });

        it("is idempotent by public_id + version: a duplicate delivery changes nothing", async () => {
            const record = await Media.create(makeMediaAttrs());
            expect((await deliver(uploadNote(record))).action).toBe(
                "reconciled"
            );
            const after = await Media.findById(record._id).lean();
            const again = await deliver(uploadNote(record));
            expect(again).toEqual({ received: true, action: "ignored" });
            expect(await Media.findById(record._id).lean()).toEqual(after);
        });

        it("ignores an older version that arrives late", async () => {
            const record = await Media.create(makeMediaAttrs());
            const result = await deliver(uploadNote(record, { version: 1 }));
            expect(result.action).toBe("ignored");
            expect((await Media.findById(record._id)).version).toBe(1700000001);
        });

        it("never makes a pending record ready: only confirm does (MEDIA-15a)", async () => {
            const record = await Media.create(makePendingAttrs());
            const result = await deliver(uploadNote(record));
            expect(result.action).toBe("ignored");
            expect((await Media.findById(record._id)).status).toBe("pending");
        });

        it("acknowledges assets it does not know and notifications without a version", async () => {
            const record = await Media.create(makeMediaAttrs());
            expect(
                (
                    await deliver({
                        notification_type: "upload",
                        public_id: "other/x",
                        version: 5,
                    })
                ).action
            ).toBe("ignored");
            expect(
                (
                    await deliver({
                        notification_type: "upload",
                        public_id: record.publicId,
                    })
                ).action
            ).toBe("ignored");
        });
    });

    describe("moderation notifications", () => {
        const rejected = (record) => ({
            notification_type: "moderation",
            moderation_status: "rejected",
            public_id: record.publicId,
            version: 1700000001,
        });

        it("retires a rejected asset and deletes it; a repeated delivery does nothing more", async () => {
            const record = await Media.create(makeMediaAttrs());
            expect((await deliver(rejected(record))).action).toBe("rejected");
            expect(await withDeleted({ _id: record._id })).toMatchObject({
                status: "deleted",
                purgedAt: NOW,
            });
            expect(cloudinaryFake.destroys).toHaveLength(1);

            expect((await deliver(rejected(record))).action).toBe("ignored");
            expect(cloudinaryFake.destroys).toHaveLength(1);
        });

        it("keeps approved assets and ignores moderation of unknown assets", async () => {
            const record = await Media.create(makeMediaAttrs());
            expect(
                (
                    await deliver({
                        ...rejected(record),
                        moderation_status: "approved",
                    })
                ).action
            ).toBe("ignored");
            expect(
                (
                    await deliver({
                        notification_type: "moderation",
                        moderation_status: "rejected",
                        public_id: "nope",
                    })
                ).action
            ).toBe("ignored");
            expect(
                (
                    await deliver({
                        notification_type: "moderation",
                        moderation_status: "rejected",
                    })
                ).action
            ).toBe("ignored");
            expect((await Media.findById(record._id)).status).toBe("ready");
        });
    });

    describe("delete notifications", () => {
        it("marks records deleted and purged without calling Cloudinary again", async () => {
            const first = await Media.create(makeMediaAttrs());
            const second = await Media.create(makeMediaAttrs());
            const result = await deliver({
                notification_type: "delete",
                resources: [
                    { public_id: first.publicId, resource_type: "video" },
                    { public_id: second.publicId },
                    { public_id: "unknown/one" },
                ],
            });
            expect(result.action).toBe("deleted");
            for (const record of [first, second])
                expect(await withDeleted({ _id: record._id })).toMatchObject({
                    status: "deleted",
                    purgedAt: NOW,
                });
            expect(cloudinaryFake.destroys).toHaveLength(0);
            expect(
                (
                    await deliver({
                        notification_type: "delete",
                        public_id: first.publicId,
                    })
                ).action
            ).toBe("ignored");
        });
    });

    describe("payload handling", () => {
        const signedRaw = (rawBody) =>
            handleMediaWebhook({
                rawBody,
                timestamp: String(seconds),
                signature: sha1(
                    `${rawBody}${seconds}${env.cloudinary.apiSecret}`
                ),
                now: NOW,
            });

        it("acknowledges (200) a validly signed body that is not JSON or not a notification", async () => {
            for (const raw of ["not json", "[]", '{"public_id":"x"}'])
                expect(await signedRaw(raw)).toEqual({
                    received: true,
                    action: "ignored",
                });
        });

        it("ignores notification types it does not handle, including prototype names", async () => {
            for (const type of [
                "resource_context",
                "constructor",
                "__proto__",
                "toString",
            ])
                expect(
                    (await deliver({ notification_type: type })).action
                ).toBe("ignored");
        });
    });
});
