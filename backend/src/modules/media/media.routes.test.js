import { createHash } from "node:crypto";
import request from "supertest";
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
    makeActor,
    makeCloudinaryAsset,
    makeMediaAttrs,
    newId,
} from "#tests/factories/media.factory.js";
import { buildApp, createCsrfAgent } from "#tests/helpers/appFactory.js";
import { expectError, expectSuccess } from "#tests/helpers/envelopes.js";
import {
    asHeader,
    headerAuth,
    USER_HEADER,
} from "#tests/helpers/headerAuthStub.js";
import {
    clearCollections,
    startTestDb,
    stopTestDb,
} from "#tests/helpers/testDb.js";
import { Media } from "./media.model.js";
import { createMediaRouter } from "./media.routes.js";

vi.mock("cloudinary", async (importOriginal) =>
    (
        await import("#integrations/cloudinary/cloudinary.mock.js")
    ).buildMockedCloudinaryModule(await importOriginal())
);

const API = "/api/v1";
const MB = 1024 * 1024;
const NOW = new Date("2026-10-26T10:00:00.000Z");
const seconds = Math.floor(NOW.getTime() / 1000);
const sha1 = (text) => createHash("sha1").update(text).digest("hex");

function makeApp(limits) {
    return buildApp({
        mountRoutes: (api) =>
            api.use(
                "/",
                createMediaRouter({
                    ...headerAuth(),
                    ...(limits ? { limits } : {}),
                })
            ),
    }).app;
}
const as = (app, user) =>
    createCsrfAgent(app, {
        headers: user ? { [USER_HEADER]: asHeader(user) } : {},
    });
const videoBody = (overrides = {}) => ({
    kind: "learning-content",
    resourceType: "video",
    contentType: "video/mp4",
    bytes: 5 * MB,
    ...overrides,
});

describe("media routes (doc 08 section 4)", () => {
    let app;
    beforeAll(async () => {
        await startTestDb();
        await Media.init();
    });
    afterAll(stopTestDb);
    beforeEach(async () => {
        await clearCollections();
        cloudinaryFake.reset();
        app = makeApp();
    });

    describe("guard chain on every protected route (TEST-08, TEST-10)", () => {
        const id = newId();
        const routes = [
            ["post", `${API}/media/signatures`, videoBody(), true],
            ["post", `${API}/media/confirm`, { mediaId: id }, true],
            ["get", `${API}/media/${id}/access`, undefined, false],
            ["delete", `${API}/media/${id}`, undefined, false],
            ["put", `${API}/me/avatar`, undefined, false],
            ["delete", `${API}/me/avatar`, undefined, false],
        ];

        it.each(routes)(
            "%s %s answers 401 AUTH_REQUIRED without a session",
            async (method, url, body) => {
                const client = await as(app, null);
                const response = await client[method](url).send(body);
                expectError(response, 401, "AUTH_REQUIRED");
            }
        );

        it.each(routes)(
            "%s %s answers 403 FORBIDDEN for an unknown role",
            async (method, url, body) => {
                const client = await as(app, makeActor({ role: "guest" }));
                expectError(
                    await client[method](url).send(body),
                    403,
                    "FORBIDDEN"
                );
            }
        );

        it.each(routes.filter(([method]) => method !== "get"))(
            "%s %s answers 403 CSRF_INVALID without the CSRF header",
            async (method, url, body) => {
                const { agent } = await as(app, makeActor());
                const response = await agent[method](url)
                    .set(USER_HEADER, asHeader(makeActor()))
                    .send(body);
                expectError(response, 403, "CSRF_INVALID");
            }
        );

        it("learners cannot reach the signature and confirm routes (403)", async () => {
            const learner = await as(app, makeActor({ role: "learner" }));
            expectError(
                await learner.post(`${API}/media/signatures`).send(videoBody()),
                403,
                "FORBIDDEN"
            );
            expectError(
                await learner
                    .post(`${API}/media/confirm`)
                    .send({ mediaId: newId() }),
                403,
                "FORBIDDEN"
            );
        });
    });

    describe("POST /media/signatures", () => {
        it("issues a signature (201) with the fields the browser needs and no secret", async () => {
            const trainer = await as(app, makeActor());
            const response = await trainer
                .post(`${API}/media/signatures`)
                .send(videoBody({ filename: "lesson.mp4" }));
            const { data } = expectSuccess(response, 201);
            expect(Object.keys(data).sort()).toEqual(
                [
                    "allowedFormats",
                    "apiKey",
                    "cloudName",
                    "expiresAt",
                    "folder",
                    "maxBytes",
                    "mediaId",
                    "publicId",
                    "resourceType",
                    "signature",
                    "timestamp",
                    "type",
                    "uploadParams",
                ].sort()
            );
            expect(data).toMatchObject({
                folder: "samarth-ai/test/learning-content",
                resourceType: "video",
                maxBytes: 100 * MB,
            });
            expect(JSON.stringify(response.body)).not.toContain(
                env.cloudinary.apiSecret
            );
            expect(response.headers["cache-control"]).toBe("no-store");
            expect(await Media.countDocuments({ status: "pending" })).toBe(1);
        });

        it.each([
            ["an unknown kind", { kind: "videos" }, "kind"],
            [
                "a missing content type",
                { contentType: undefined },
                "contentType",
            ],
            ["negative bytes", { bytes: -5 }, "bytes"],
            ["an unknown field such as orgId", { orgId: newId() }, "orgId"],
            [
                "an unknown field such as ownerId",
                { ownerId: newId() },
                "ownerId",
            ],
        ])(
            "rejects %s with 400 VALIDATION_ERROR naming the field",
            async (_label, patch, field) => {
                const trainer = await as(app, makeActor());
                const body = expectError(
                    await trainer
                        .post(`${API}/media/signatures`)
                        .send(videoBody(patch)),
                    400,
                    "VALIDATION_ERROR"
                );
                expect(body.errors.map((e) => e.field)).toContain(field);
            }
        );

        it("answers 403 for a kind the role may not upload and 400 / 413 for policy failures", async () => {
            const trainer = await as(app, makeActor());
            expectError(
                await trainer
                    .post(`${API}/media/signatures`)
                    .send(videoBody({ kind: "marketing" })),
                403,
                "FORBIDDEN"
            );
            expectError(
                await trainer.post(`${API}/media/signatures`).send(
                    videoBody({
                        resourceType: "image",
                        contentType: "image/svg+xml",
                    })
                ),
                400,
                "MEDIA_TYPE_NOT_ALLOWED"
            );
            expectError(
                await trainer
                    .post(`${API}/media/signatures`)
                    .send(videoBody({ bytes: 101 * MB })),
                413,
                "MEDIA_TOO_LARGE"
            );
            expectError(
                await trainer
                    .post(`${API}/media/signatures`)
                    .send(videoBody({ bytes: 0 })),
                400,
                "UPLOAD_INVALID"
            );
        });

        it("rejects malformed JSON with 400 INVALID_JSON", async () => {
            const { agent, token } = await as(app, makeActor());
            const response = await agent
                .post(`${API}/media/signatures`)
                .set(USER_HEADER, asHeader(makeActor()))
                .set("X-CSRF-Token", token)
                .set("Content-Type", "application/json")
                .send("{bad");
            expectError(response, 400, "INVALID_JSON");
        });
    });

    describe("POST /media/confirm", () => {
        async function signAndUpload(trainer) {
            const { data } = expectSuccess(
                await trainer.post(`${API}/media/signatures`).send(videoBody()),
                201
            );
            const record = await Media.findById(data.mediaId);
            cloudinaryFake.resourceResult = makeCloudinaryAsset(record, {
                bytes: 3000,
            });
            return { data, record };
        }

        it("confirms with the facts Cloudinary reports (200) and a replay returns the same record", async () => {
            const user = makeActor();
            const trainer = await as(app, user);
            const { data } = await signAndUpload(trainer);
            const first = expectSuccess(
                await trainer
                    .post(`${API}/media/confirm`)
                    .send({ mediaId: data.mediaId })
            );
            expect(first.data).toMatchObject({
                id: data.mediaId,
                status: "ready",
                bytes: 3000,
                format: "mp4",
            });
            const second = expectSuccess(
                await trainer
                    .post(`${API}/media/confirm`)
                    .send({ mediaId: data.mediaId })
            );
            expect(second.data).toEqual(first.data);
            expect(cloudinaryFake.resources).toHaveLength(1);
        });

        it("rejects bad bodies (400), a missing asset (404) and someone else's record (404)", async () => {
            const user = makeActor();
            const trainer = await as(app, user);
            expectError(
                await trainer.post(`${API}/media/confirm`).send({}),
                400,
                "VALIDATION_ERROR"
            );
            expectError(
                await trainer
                    .post(`${API}/media/confirm`)
                    .send({ mediaId: "x", publicId: "y" }),
                400,
                "VALIDATION_ERROR"
            );
            expectError(
                await trainer
                    .post(`${API}/media/confirm`)
                    .send({ mediaId: "not-an-id" }),
                400,
                "INVALID_ID"
            );
            const { data } = await signAndUpload(trainer);
            cloudinaryFake.resourceError = { http_code: 404 };
            expectError(
                await trainer
                    .post(`${API}/media/confirm`)
                    .send({ mediaId: data.mediaId }),
                404,
                "MEDIA_NOT_FOUND"
            );
            const other = await as(app, makeActor({ orgId: user.orgId }));
            expectError(
                await other
                    .post(`${API}/media/confirm`)
                    .send({ mediaId: data.mediaId }),
                404,
                "MEDIA_NOT_FOUND"
            );
        });

        it("answers 413 MEDIA_TOO_LARGE and deletes the asset when the real file is oversize", async () => {
            const trainer = await as(app, makeActor());
            const { data, record } = await signAndUpload(trainer);
            cloudinaryFake.resourceResult = makeCloudinaryAsset(record, {
                bytes: 101 * MB,
            });
            expectError(
                await trainer
                    .post(`${API}/media/confirm`)
                    .send({ mediaId: data.mediaId }),
                413,
                "MEDIA_TOO_LARGE"
            );
            expect(cloudinaryFake.destroys).toHaveLength(1);
        });
    });

    describe("GET /media/:id/access and DELETE /media/:id", () => {
        const secret = (user, overrides = {}) =>
            Media.create(
                makeMediaAttrs({
                    resourceType: "raw",
                    deliveryType: "authenticated",
                    format: "pdf",
                    ownerId: user.id,
                    orgId: user.orgId,
                    ...overrides,
                })
            );

        it("returns a signed link to the owner and 404 to a stranger (IDOR)", async () => {
            const owner = makeActor();
            const doc = await secret(owner);
            const mine = await as(app, owner);
            const { data } = expectSuccess(
                await mine.get(`${API}/media/${doc._id}/access`)
            );
            expect(data.url).toContain("authenticated");
            expect(data.expiresAt).toMatch(/Z$/);
            const stranger = await as(app, makeActor({ orgId: owner.orgId }));
            expectError(
                await stranger.get(`${API}/media/${doc._id}/access`),
                404,
                "MEDIA_NOT_FOUND"
            );
            expectError(
                await mine.get(`${API}/media/${newId()}/access`),
                404,
                "MEDIA_NOT_FOUND"
            );
            expectError(
                await mine.get(`${API}/media/bad-id/access`),
                400,
                "INVALID_ID"
            );
        });

        it("deletes for the owner (200), then 404, and never for a stranger", async () => {
            const owner = makeActor();
            const doc = await secret(owner);
            const stranger = await as(app, makeActor({ orgId: owner.orgId }));
            expectError(
                await stranger.delete(`${API}/media/${doc._id}`),
                404,
                "MEDIA_NOT_FOUND"
            );
            expect(cloudinaryFake.destroys).toHaveLength(0);

            const mine = await as(app, owner);
            const { data } = expectSuccess(
                await mine.delete(`${API}/media/${doc._id}`)
            );
            expect(data).toEqual({ id: String(doc._id), status: "deleted" });
            expect(cloudinaryFake.destroys).toHaveLength(1);
            expectError(
                await mine.delete(`${API}/media/${doc._id}`),
                404,
                "MEDIA_NOT_FOUND"
            );
        });

        it("answers 409 when asked to delete an avatar through this route", async () => {
            const owner = makeActor();
            const doc = await secret(owner, {
                kind: "avatars",
                resourceType: "image",
                deliveryType: "public",
            });
            const mine = await as(app, owner);
            expectError(
                await mine.delete(`${API}/media/${doc._id}`),
                409,
                "CONFLICT"
            );
        });
    });

    describe("rate limits (BE-61, doc 08 section 9)", () => {
        it("limits signatures and confirm together per user and answers 429 RATE_LIMITED with Retry-After", async () => {
            const limited = makeApp({
                upload: { windowMs: 60_000, limit: 2 },
                avatar: { windowMs: 60_000, limit: 2 },
            });
            const user = makeActor();
            const trainer = await as(limited, user);
            expectSuccess(
                await trainer.post(`${API}/media/signatures`).send(videoBody()),
                201
            );
            expectError(
                await trainer
                    .post(`${API}/media/confirm`)
                    .send({ mediaId: newId() }),
                404,
                "MEDIA_NOT_FOUND"
            );
            const response = await trainer
                .post(`${API}/media/signatures`)
                .send(videoBody());
            const body = expectError(response, 429, "RATE_LIMITED");
            expect(response.headers["retry-after"]).toBeTruthy();
            expect(body.retryAfterSec ?? body.errors).toBeDefined();

            const colleague = await as(limited, makeActor());
            expectSuccess(
                await colleague
                    .post(`${API}/media/signatures`)
                    .send(videoBody()),
                201
            );
        });
    });

    describe("POST /media/webhook (MEDIA-15, EDGE-53)", () => {
        const url = `${API}/media/webhook`;
        const payload = (record) =>
            JSON.stringify({
                notification_type: "upload",
                public_id: record.publicId,
                version: 1700000050,
                bytes: 7000,
            });
        const post = (rawBody, headers = {}) => {
            const call = request(app)
                .post(url)
                .set("Content-Type", "application/json");
            for (const [name, value] of Object.entries(headers))
                call.set(name, value);
            return call.send(rawBody);
        };
        const signedHeaders = (rawBody, timestamp = seconds) => ({
            "X-Cld-Timestamp": String(timestamp),
            "X-Cld-Signature": sha1(
                `${rawBody}${timestamp}${env.cloudinary.apiSecret}`
            ),
        });

        beforeEach(() => {
            vi.useFakeTimers({ toFake: ["Date"] });
            vi.setSystemTime(NOW);
        });

        it("needs no session and no CSRF header, and applies a correctly signed notification once", async () => {
            const record = await Media.create(makeMediaAttrs());
            const rawBody = payload(record);
            const first = expectSuccess(
                await post(rawBody, signedHeaders(rawBody))
            );
            expect(first.data).toEqual({
                received: true,
                action: "reconciled",
            });
            const duplicate = expectSuccess(
                await post(rawBody, signedHeaders(rawBody))
            );
            expect(duplicate.data).toEqual({
                received: true,
                action: "ignored",
            });
            expect((await Media.findById(record._id)).bytes).toBe(7000);
        });

        it.each([
            [
                "a bad signature",
                () => ({
                    "X-Cld-Timestamp": String(seconds),
                    "X-Cld-Signature": "f".repeat(40),
                }),
            ],
            ["a stale timestamp", (raw) => signedHeaders(raw, seconds - 7300)],
            ["no signature headers", () => ({})],
        ])(
            "answers 400 WEBHOOK_SIGNATURE_INVALID for %s and changes nothing",
            async (_label, headersFor) => {
                const record = await Media.create(makeMediaAttrs());
                const rawBody = payload(record);
                expectError(
                    await post(rawBody, headersFor(rawBody)),
                    400,
                    "WEBHOOK_SIGNATURE_INVALID"
                );
                expect((await Media.findById(record._id)).bytes).toBe(2048);
            }
        );

        it("rejects a tampered body even with the original signature", async () => {
            const record = await Media.create(makeMediaAttrs());
            const rawBody = payload(record);
            const headers = signedHeaders(rawBody);
            expectError(
                await post(rawBody.replace("7000", "9000"), headers),
                400,
                "WEBHOOK_SIGNATURE_INVALID"
            );
        });

        it("rejects a body that was not captured raw (non-JSON content type)", async () => {
            const rawBody = "notification_type=upload";
            const response = await request(app)
                .post(url)
                .set("Content-Type", "text/plain")
                .set(signedHeaders(rawBody))
                .send(rawBody);
            expectError(response, 400, "WEBHOOK_SIGNATURE_INVALID");
        });
    });

    it("the other routes still need CSRF: the webhook exemption does not leak", async () => {
        const { agent } = await as(app, makeActor());
        const response = await agent
            .post(`${API}/media/signatures`)
            .set(USER_HEADER, asHeader(makeActor()))
            .send(videoBody());
        expectError(response, 403, "CSRF_INVALID");
    });
});
