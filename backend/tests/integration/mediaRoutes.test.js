import { randomBytes } from "node:crypto";
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
import { cloudinaryFake } from "#integrations/cloudinary/cloudinary.mock.js";
import { mediaRouter } from "#modules/media/index.js";
import { usersPort } from "#modules/media/mediaAvatar.service.js";
import { Media } from "#modules/media/media.model.js";
import { signAccessToken } from "#utils/accessToken.js";
import { makeCloudinaryAsset } from "#tests/factories/media.factory.js";
import { buildApp, request } from "#tests/helpers/appFactory.js";
import { startAuthDb, resetAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { expectError, expectSuccess } from "#tests/helpers/envelopes.js";
import { pngBuffer } from "#tests/helpers/fileFixtures.js";

vi.mock("cloudinary", async (importOriginal) =>
    (
        await import("#integrations/cloudinary/cloudinary.mock.js")
    ).buildMockedCloudinaryModule(await importOriginal())
);

const API = "/api/v1";
const CSRF = randomBytes(24).toString("base64url");
const { app } = buildApp({ mountRoutes: (api) => api.use("/", mediaRouter) });

/** Creates an active user with a live session and returns a request helper that sends its real cookies. */
async function signIn(role) {
    const orgId = new mongoose.Types.ObjectId();
    const user = await mongoose.model("User").create({
        orgId,
        email: `${randomBytes(4).toString("hex")}@example.test`,
        name: "Media Tester",
        role,
        status: "active",
    });
    const familyId = new mongoose.Types.ObjectId();
    await mongoose.model("RefreshSession").create({
        orgId,
        userId: user._id,
        familyId: String(familyId),
        tokenHash: randomBytes(32).toString("hex"),
        expiresAt: new Date(Date.now() + 3_600_000),
        absoluteExpiresAt: new Date(Date.now() + 7_200_000),
    });
    const token = signAccessToken({
        userId: user._id,
        role,
        orgId,
        sid: familyId,
        tokenVersion: 0,
    });
    const send = (method, url) => {
        const call = request(app)[method](url);
        return call
            .set("Cookie", `sai_access=${token}; sai_csrf=${CSRF}`)
            .set("X-CSRF-Token", CSRF);
    };
    return { user, send, familyId };
}

describe("media routes with the real authenticate / authorize", () => {
    beforeAll(startAuthDb);
    afterAll(stopTestDb);
    beforeEach(async () => {
        await resetAuthDb();
        cloudinaryFake.reset();
    });

    it("answers 401 AUTH_REQUIRED without the access cookie", async () => {
        const response = await request(app)
            .post(`${API}/media/signatures`)
            .set("Cookie", `sai_csrf=${CSRF}`)
            .set("X-CSRF-Token", CSRF)
            .send({});
        expectError(response, 401, "AUTH_REQUIRED");
    });

    it("a learner may not request signatures (403) but a trainer may, then confirm (200)", async () => {
        const body = {
            kind: "learning-content",
            resourceType: "video",
            contentType: "video/mp4",
            bytes: 4096,
        };
        const learner = await signIn("learner");
        expectError(
            await learner.send("post", `${API}/media/signatures`).send(body),
            403,
            "FORBIDDEN"
        );

        const trainer = await signIn("trainer");
        const { data } = expectSuccess(
            await trainer.send("post", `${API}/media/signatures`).send(body),
            201
        );
        const record = await Media.findById(data.mediaId);
        expect(String(record.ownerId)).toBe(String(trainer.user._id));
        expect(String(record.orgId)).toBe(String(trainer.user.orgId));

        cloudinaryFake.resourceResult = makeCloudinaryAsset(record);
        const confirmed = expectSuccess(
            await trainer
                .send("post", `${API}/media/confirm`)
                .send({ mediaId: data.mediaId })
        );
        expect(confirmed.data.status).toBe("ready");
        expectError(
            await learner
                .send("post", `${API}/media/confirm`)
                .send({ mediaId: data.mediaId }),
            403,
            "FORBIDDEN"
        );
    });

    it("another user's media is a 404 for both access and delete", async () => {
        const owner = await signIn("trainer");
        const stranger = await signIn("trainer");
        const doc = await Media.create({
            orgId: owner.user.orgId,
            ownerId: owner.user._id,
            publicId: "samarth-ai/test/learning-content/doc1",
            resourceType: "raw",
            kind: "learning-content",
            deliveryType: "authenticated",
            status: "ready",
            format: "pdf",
        });
        expectSuccess(
            await owner.send("get", `${API}/media/${doc._id}/access`)
        );
        expectError(
            await stranger.send("get", `${API}/media/${doc._id}/access`),
            404,
            "MEDIA_NOT_FOUND"
        );
        expectError(
            await stranger.send("delete", `${API}/media/${doc._id}`),
            404,
            "MEDIA_NOT_FOUND"
        );
    });

    it("a revoked session is rejected before any media code runs", async () => {
        const trainer = await signIn("trainer");
        await mongoose
            .model("RefreshSession")
            .updateMany({}, { revokedAt: new Date() });
        expectError(
            await trainer.send("delete", `${API}/me/avatar`),
            401,
            "SESSION_REVOKED"
        );
    });

    it("PUT /me/avatar works for a learner session and hands the avatar to the users port", async () => {
        const learner = await signIn("learner");
        vi.spyOn(usersPort, "replaceAvatar").mockImplementation(
            async ({ userId, avatar }) => ({
                user: { id: userId, avatar },
                previousAvatar: null,
            })
        );
        const response = await learner
            .send("put", `${API}/me/avatar`)
            .attach("file", pngBuffer(), {
                filename: "me.png",
                contentType: "image/png",
            });
        const { data } = expectSuccess(response);
        expect(data.user.id).toBe(String(learner.user._id));
        expect(usersPort.replaceAvatar).toHaveBeenCalledOnce();
    });
});
