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
import { cloudinaryFake } from "#integrations/cloudinary/cloudinary.mock.js";
import { makeActor, makeMediaAttrs } from "#tests/factories/media.factory.js";
import { buildApp, createCsrfAgent } from "#tests/helpers/appFactory.js";
import { expectError, expectSuccess } from "#tests/helpers/envelopes.js";
import {
    asHeader,
    headerAuth,
    USER_HEADER,
} from "#tests/helpers/headerAuthStub.js";
import {
    exeBuffer,
    gifBuffer,
    htmlBuffer,
    jpegBuffer,
    pdfBuffer,
    pngBuffer,
    svgBuffer,
    webpBuffer,
} from "#tests/helpers/fileFixtures.js";
import {
    clearCollections,
    startTestDb,
    stopTestDb,
} from "#tests/helpers/testDb.js";
import { Media } from "./media.model.js";
import { createMediaRouter } from "./media.routes.js";
import { usersPort } from "./mediaAvatar.service.js";

vi.mock("cloudinary", async (importOriginal) =>
    (
        await import("#integrations/cloudinary/cloudinary.mock.js")
    ).buildMockedCloudinaryModule(await importOriginal())
);

const URL = "/api/v1/me/avatar";
const MB = 1024 * 1024;
const SUMMARY = { id: "u1", name: "Test User" };

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
    createCsrfAgent(app, { headers: { [USER_HEADER]: asHeader(user) } });
const attach = (client, buffer, filename, contentType) =>
    client.put(URL).attach("file", buffer, { filename, contentType });

/** Fake users module: remembers the avatar like the real one, so replace and remove can be observed. */
function fakeUsers(initial = null) {
    const state = { avatar: initial };
    vi.spyOn(usersPort, "replaceAvatar").mockImplementation(
        async ({ avatar }) => {
            const previousAvatar = state.avatar;
            state.avatar = avatar;
            return { user: { ...SUMMARY, avatar }, previousAvatar };
        }
    );
    vi.spyOn(usersPort, "clearAvatar").mockImplementation(async () => {
        const previousAvatar = state.avatar;
        state.avatar = null;
        return { user: { ...SUMMARY, avatar: null }, previousAvatar };
    });
    return state;
}

describe("avatar routes: PUT and DELETE /me/avatar (EDGE-108)", () => {
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

    describe("PUT /me/avatar", () => {
        it("refuses an upload without the CSRF header before any file is parsed (403 CSRF_INVALID)", async () => {
            const response = await request(app)
                .put(URL)
                .set(USER_HEADER, asHeader(makeActor()))
                .attach("file", pngBuffer(), {
                    filename: "me.png",
                    contentType: "image/png",
                });
            expectError(response, 403, "CSRF_INVALID");
            expect(cloudinaryFake.uploads).toHaveLength(0);
        });

        it.each([
            ["png", pngBuffer(), "me.png", "image/png"],
            ["jpeg", jpegBuffer(), "me.jpg", "image/jpeg"],
            ["webp", webpBuffer(), "me.webp", "image/webp"],
        ])(
            "accepts a valid %s for every role and returns the user summary (200)",
            async (_label, buffer, filename, type) => {
                fakeUsers();
                for (const role of [
                    "learner",
                    "trainer",
                    "admin",
                    "superadmin",
                ]) {
                    const client = await as(app, makeActor({ role }));
                    const { data } = expectSuccess(
                        await attach(client, buffer, filename, type)
                    );
                    expect(data.user).toMatchObject({ id: "u1" });
                    expect(data.user.avatar.publicId).toMatch(
                        /^samarth-ai\/test\/avatars\//
                    );
                }
                expect(cloudinaryFake.uploads).toHaveLength(4);
            }
        );

        it("strips location data: the SDK upload carries the force_strip flag (MEDIA-10)", async () => {
            fakeUsers();
            const exifJpeg = Buffer.concat([
                jpegBuffer(),
                Buffer.from("Exif\u0000\u0000GPSLatitude GPSLongitude"),
            ]);
            const client = await as(app, makeActor());
            expectSuccess(
                await attach(client, exifJpeg, "gps.jpg", "image/jpeg")
            );
            expect(cloudinaryFake.uploads[0].options.transformation).toEqual([
                { flags: "force_strip" },
            ]);
        });

        it.each([
            [
                "a PDF",
                pdfBuffer(),
                "x.pdf",
                "application/pdf",
                400,
                "MEDIA_TYPE_NOT_ALLOWED",
            ],
            [
                "an SVG with a script",
                svgBuffer(),
                "x.svg",
                "image/svg+xml",
                400,
                "MEDIA_TYPE_NOT_ALLOWED",
            ],
            [
                "a GIF",
                gifBuffer(),
                "x.gif",
                "image/gif",
                400,
                "MEDIA_TYPE_NOT_ALLOWED",
            ],
            [
                "an executable renamed .png with an image type",
                exeBuffer(),
                "me.png",
                "image/png",
                400,
                "MEDIA_TYPE_NOT_ALLOWED",
            ],
            [
                "HTML renamed .jpg with an image type",
                htmlBuffer(),
                "me.jpg",
                "image/jpeg",
                400,
                "MEDIA_TYPE_NOT_ALLOWED",
            ],
            [
                "a PNG named .jpg (extension mismatch)",
                pngBuffer(),
                "me.jpg",
                "image/png",
                400,
                "MEDIA_TYPE_NOT_ALLOWED",
            ],
            [
                "a JPEG that claims to be a PNG (spoofed bytes)",
                jpegBuffer(),
                "me.png",
                "image/png",
                400,
                "MEDIA_TYPE_NOT_ALLOWED",
            ],
            [
                "a zero-byte file",
                Buffer.alloc(0),
                "me.png",
                "image/png",
                400,
                "UPLOAD_INVALID",
            ],
            [
                "an image over 2 MB",
                Buffer.concat([pngBuffer(), Buffer.alloc(2 * MB)]),
                "big.png",
                "image/png",
                413,
                "FILE_TOO_LARGE",
            ],
        ])(
            "rejects %s (%s) without touching Cloudinary or the user",
            async (_label, buffer, filename, type, status, code) => {
                fakeUsers({ publicId: "keep/me" });
                const client = await as(app, makeActor());
                expectError(
                    await attach(client, buffer, filename, type),
                    status,
                    code
                );
                expect(cloudinaryFake.uploads).toHaveLength(0);
                expect(usersPort.replaceAvatar).not.toHaveBeenCalled();
            }
        );

        it("rejects more than one file and files under another field name (400 UPLOAD_INVALID)", async () => {
            fakeUsers();
            const client = await as(app, makeActor());
            expectError(
                await client
                    .put(URL)
                    .attach("file", pngBuffer(), {
                        filename: "a.png",
                        contentType: "image/png",
                    })
                    .attach("file", pngBuffer(), {
                        filename: "b.png",
                        contentType: "image/png",
                    }),
                400,
                "UPLOAD_INVALID"
            );
            expectError(
                await client.put(URL).attach("photo", pngBuffer(), {
                    filename: "a.png",
                    contentType: "image/png",
                }),
                400,
                "UPLOAD_INVALID"
            );
            expect(cloudinaryFake.uploads).toHaveLength(0);
        });

        it("rejects a request without a file and extra text fields such as userId", async () => {
            fakeUsers();
            const client = await as(app, makeActor());
            expectError(
                await client.put(URL).field("note", "x"),
                400,
                "UPLOAD_INVALID"
            );
            expectError(
                await client
                    .put(URL)
                    .field("userId", "someone-else")
                    .attach("file", pngBuffer(), {
                        filename: "a.png",
                        contentType: "image/png",
                    }),
                400,
                "VALIDATION_ERROR"
            );
            expect(usersPort.replaceAvatar).not.toHaveBeenCalled();
        });

        it("keeps the old avatar and answers 502 MEDIA_UPLOAD_FAILED when Cloudinary fails (corrupt file, outage)", async () => {
            const state = fakeUsers({ publicId: "keep/me" });
            cloudinaryFake.uploadError = new Error("Invalid image file");
            const client = await as(app, makeActor());
            expectError(
                await attach(client, pngBuffer(), "me.png", "image/png"),
                502,
                "MEDIA_UPLOAD_FAILED"
            );
            expect(state.avatar.publicId).toBe("keep/me");
            expect(await Media.countDocuments()).toBe(0);
        });

        it("replacing an avatar deletes the previous asset and its media record", async () => {
            const user = makeActor();
            const old = await Media.create(
                makeMediaAttrs({
                    kind: "avatars",
                    resourceType: "image",
                    ownerId: user.id,
                    orgId: user.orgId,
                })
            );
            fakeUsers({ publicId: old.publicId });
            const client = await as(app, user);
            expectSuccess(
                await attach(client, pngBuffer(), "new.png", "image/png")
            );
            expect(cloudinaryFake.destroys.map((d) => d.publicId)).toEqual([
                old.publicId,
            ]);
            const retired = await Media.findById(old._id).setOptions({
                withDeleted: true,
            });
            expect(retired.status).toBe("deleted");
        });

        it("limits uploads per user (429 RATE_LIMITED) without affecting other users", async () => {
            fakeUsers();
            const limited = makeApp({
                upload: { windowMs: 60_000, limit: 5 },
                avatar: { windowMs: 60_000, limit: 2 },
            });
            const client = await as(limited, makeActor());
            for (let i = 0; i < 2; i += 1)
                expectSuccess(
                    await attach(client, pngBuffer(), "me.png", "image/png")
                );
            const blocked = await attach(
                client,
                pngBuffer(),
                "me.png",
                "image/png"
            );
            expectError(blocked, 429, "RATE_LIMITED");
            expect(blocked.headers["retry-after"]).toBeTruthy();
            const other = await as(limited, makeActor());
            expectSuccess(
                await attach(other, pngBuffer(), "me.png", "image/png")
            );
        });
    });

    describe("DELETE /me/avatar", () => {
        it("removes the avatar, deletes the asset and returns the user summary", async () => {
            const user = makeActor();
            const old = await Media.create(
                makeMediaAttrs({
                    kind: "avatars",
                    resourceType: "image",
                    ownerId: user.id,
                    orgId: user.orgId,
                })
            );
            fakeUsers({ publicId: old.publicId });
            const client = await as(app, user);
            const { data } = expectSuccess(await client.delete(URL));
            expect(data.user).toEqual({ ...SUMMARY, avatar: null });
            expect(cloudinaryFake.destroys.map((d) => d.publicId)).toEqual([
                old.publicId,
            ]);
        });

        it("is idempotent without an avatar, and refuses a request body", async () => {
            fakeUsers(null);
            const client = await as(app, makeActor());
            expectSuccess(await client.delete(URL));
            expectSuccess(await client.delete(URL));
            expect(cloudinaryFake.destroys).toHaveLength(0);
            expectError(
                await client.delete(URL).send({ userId: "someone-else" }),
                400,
                "VALIDATION_ERROR"
            );
        });
    });
});
