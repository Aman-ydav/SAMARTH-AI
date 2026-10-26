import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { Invite } from "./invite.model.js";

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

const id = () => new mongoose.Types.ObjectId();
const orgId = id();
const makeInvite = (overrides = {}) => ({
    orgId,
    email: "Invitee@Example.TEST",
    role: "trainer",
    invitedBy: id(),
    tokenId: id(),
    expiresAt: new Date(Date.now() + 7 * 86_400_000),
    ...overrides,
});

describe("Invite model", () => {
    it("normalises the email and defaults to status sent with no resends", async () => {
        const invite = await Invite.create(makeInvite());
        expect(invite).toMatchObject({
            email: "invitee@example.test",
            status: "sent",
            resentCount: 0,
            acceptedAt: null,
        });
    });

    it("allows only learner, trainer and admin roles (never superadmin)", async () => {
        await expect(
            Invite.create(makeInvite({ role: "superadmin" }))
        ).rejects.toThrow();
        await expect(
            Invite.create(makeInvite({ role: "admin" }))
        ).resolves.toBeTruthy();
    });

    it("limits resends to 5 and validates the status enum", async () => {
        await expect(
            Invite.create(makeInvite({ resentCount: 6 }))
        ).rejects.toThrow();
        await expect(
            Invite.create(makeInvite({ status: "pending" }))
        ).rejects.toThrow();
    });

    it("has one OPEN invite per org and email (partial unique index); history rows may repeat", async () => {
        const indexes = await Invite.collection.indexes();
        const partial = indexes.find(
            (index) => index.name === "invites_orgId_email_pf_uq"
        );
        expect(partial).toMatchObject({
            unique: true,
            partialFilterExpression: { status: "sent" },
        });

        await Invite.create(makeInvite());
        await expect(Invite.create(makeInvite())).rejects.toMatchObject({
            code: 11000,
        });
        await Invite.create(makeInvite({ email: "other@example.test" }));
        const open = await Invite.findOne({ email: "invitee@example.test" });
        open.status = "revoked";
        await open.save();
        await expect(Invite.create(makeInvite())).resolves.toBeTruthy();
        await Invite.create(makeInvite({ status: "accepted" }));
        expect(
            await Invite.countDocuments({ email: "invitee@example.test" })
        ).toBe(3);
    });

    it("requires org, inviter, token and expiry; invitedBy is immutable", async () => {
        await expect(
            Invite.create(makeInvite({ orgId: undefined }))
        ).rejects.toThrow(/ORG_REQUIRED/);
        await expect(
            Invite.create(makeInvite({ invitedBy: undefined }))
        ).rejects.toThrow(/INVITED_BY_REQUIRED/);
        await expect(
            Invite.create(makeInvite({ tokenId: undefined }))
        ).rejects.toThrow(/TOKEN_REQUIRED/);
        await expect(
            Invite.create(makeInvite({ expiresAt: undefined }))
        ).rejects.toThrow(/EXPIRES_AT_REQUIRED/);
        const invite = await Invite.create(makeInvite());
        const original = String(invite.invitedBy);
        invite.invitedBy = id();
        await invite.save();
        expect(String((await Invite.findById(invite._id)).invitedBy)).toBe(
            original
        );
    });

    it("toJSON exposes id and hides __v", async () => {
        const json = (await Invite.create(makeInvite())).toJSON();
        expect(json.id).toBeTruthy();
        expect(json).not.toHaveProperty("__v");
        expect(json).not.toHaveProperty("_id");
    });
});
