import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditLog } from "#modules/audit/auditLog.model.js";
import { User } from "#modules/users/user.model.js";
import { makeUser } from "#tests/factories/user.factory.js";
import { fromOtherDevice, makeAuthCtx } from "#tests/helpers/authCtx.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import {
    announceNewDevice,
    handleDevice,
    registerDevice,
} from "./device.service.js";

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

const knownDevices = async (user) =>
    (await User.findById(user._id).select("+knownDeviceHashes").lean())
        .knownDeviceHashes;

describe("registerDevice (AUTH-39)", () => {
    it("reports a device as new once, then known", async () => {
        const user = await User.create(makeUser());
        expect(
            await registerDevice({
                userId: user._id,
                userAgentHash: "a".repeat(64),
            })
        ).toBe(true);
        expect(
            await registerDevice({
                userId: user._id,
                userAgentHash: "a".repeat(64),
            })
        ).toBe(false);
        expect(
            await registerDevice({
                userId: user._id,
                userAgentHash: "b".repeat(64),
            })
        ).toBe(true);
        expect(await knownDevices(user)).toEqual([
            "a".repeat(64),
            "b".repeat(64),
        ]);
    });

    it("keeps at most 20 hashes and drops the oldest first", async () => {
        const user = await User.create(makeUser());
        const hash = (n) => String(n).padStart(64, "0");
        for (let i = 1; i <= 22; i += 1)
            await registerDevice({ userId: user._id, userAgentHash: hash(i) });
        const hashes = await knownDevices(user);
        expect(hashes).toHaveLength(20);
        expect(hashes[0]).toBe(hash(3));
        expect(hashes.at(-1)).toBe(hash(22));
    });

    it("is race-free: parallel sign-ins from one new device announce it exactly once", async () => {
        const user = await User.create(makeUser());
        const results = await Promise.all(
            Array.from({ length: 5 }, () =>
                registerDevice({
                    userId: user._id,
                    userAgentHash: "c".repeat(64),
                })
            )
        );
        expect(results.filter(Boolean)).toHaveLength(1);
        expect(await knownDevices(user)).toHaveLength(1);
    });
});

describe("announceNewDevice", () => {
    it("audits LOGIN_NEW_DEVICE (device hash only) and mails a device label with a sessions link", async () => {
        const ctx = fromOtherDevice(
            makeAuthCtx(),
            "Mozilla/5.0 (Windows NT 10.0) Chrome/126.0 Safari/537.36"
        );
        const user = await User.create(makeUser());
        await announceNewDevice({
            user,
            ctx,
            now: new Date("2026-10-26T10:00:00Z"),
        });
        await ctx.emailService.whenSettled();
        const [mail] = ctx.outbox.find({
            to: user.email,
            templateKey: "new-device",
        });
        expect(mail.data).toMatchObject({
            name: user.name,
            device: "Chrome on Windows",
            at: "2026-10-26T10:00:00.000Z",
            sessionsLink: "http://localhost:5173/settings/security",
        });
        const [event] = await AuditLog.find({ action: "LOGIN_NEW_DEVICE" })
            .limit(2)
            .lean();
        expect(event.meta).toEqual({ deviceHash: ctx.userAgentHash });
        expect(JSON.stringify(event)).not.toContain("Chrome");
    });
});

describe("handleDevice", () => {
    it("seeds the first device silently when notify is false", async () => {
        const ctx = makeAuthCtx();
        const user = await User.create(makeUser());
        expect(await handleDevice({ user, ctx, notify: false })).toBe(true);
        await ctx.emailService.whenSettled();
        expect(ctx.outbox.all()).toHaveLength(0);
        expect(await AuditLog.countDocuments({})).toBe(0);
    });

    it("notifies for an unseen device and stays quiet for a known one", async () => {
        const ctx = makeAuthCtx();
        const user = await User.create(makeUser());
        await handleDevice({ user, ctx, notify: false });
        expect(await handleDevice({ user, ctx })).toBe(false);
        const phone = fromOtherDevice(
            ctx,
            "Mozilla/5.0 (Linux; Android 14) Chrome/126.0 Mobile Safari/537.36"
        );
        expect(await handleDevice({ user, ctx: phone })).toBe(true);
        await ctx.emailService.whenSettled();
        const mails = ctx.outbox.find({ templateKey: "new-device" });
        expect(mails).toHaveLength(1);
        expect(mails[0].data.device).toBe("Chrome on Android");
        expect(
            await AuditLog.countDocuments({ action: "LOGIN_NEW_DEVICE" })
        ).toBe(1);
    });
});
