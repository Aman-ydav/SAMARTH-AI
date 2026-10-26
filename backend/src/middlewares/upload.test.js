import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
    exeBuffer,
    jpegBuffer,
    mp4Buffer,
    pdfBuffer,
    pngBuffer,
    svgBuffer,
    textBuffer,
} from "#tests/helpers/fileFixtures.js";
import { expectError } from "#tests/helpers/envelopes.js";
import { createLogger } from "#utils/logger.js";
import { createErrorHandler } from "./errorHandler.js";
import { requestId } from "./requestId.js";
import { uploadMiddleware } from "./upload.js";

const silent = createLogger({ level: "silent", isDevelopment: false });
const MB = 1024 * 1024;

function appFor(options) {
    const app = express();
    app.use(requestId());
    app.post("/upload", uploadMiddleware(options), (req, res) =>
        res.json({
            body: req.body,
            files: req.uploads.map(({ file, policy }) => ({
                name: file.originalname,
                bytes: file.size,
                hasBuffer: Buffer.isBuffer(file.buffer),
                policy: {
                    mime: policy.mime,
                    resourceType: policy.resourceType,
                    delivery: policy.delivery,
                    format: policy.format,
                },
            })),
        })
    );
    app.use(createErrorHandler({ isDevelopment: false, log: silent }));
    return app;
}
const avatars = () => appFor({ kind: "avatars", field: "file" });
const send = (app, buffer, filename, contentType, fields = {}) => {
    let req = request(app).post("/upload");
    for (const [key, value] of Object.entries(fields))
        req = req.field(key, value);
    return req.attach("file", buffer, { filename, contentType });
};

describe("uploadMiddleware (MEDIA-05, MEDIA-06)", () => {
    it("keeps a valid file in memory and attaches the policy result (no temp files)", async () => {
        const res = await send(avatars(), pngBuffer(), "me.png", "image/png");
        expect(res.status).toBe(200);
        expect(res.body.files).toEqual([
            {
                name: "me.png",
                bytes: pngBuffer().length,
                hasBuffer: true,
                policy: {
                    mime: "image/png",
                    resourceType: "image",
                    delivery: "public",
                    format: "png",
                },
            },
        ]);
    });

    it("rejects a disallowed MIME type before buffering the file: 400 MEDIA_TYPE_NOT_ALLOWED", async () => {
        expectError(
            await send(avatars(), pdfBuffer(), "x.pdf", "application/pdf"),
            400,
            "MEDIA_TYPE_NOT_ALLOWED"
        );
    });

    it("rejects spoofed magic bytes: an executable named .png with an image MIME", async () => {
        expectError(
            await send(avatars(), exeBuffer(), "me.png", "image/png"),
            400,
            "MEDIA_TYPE_NOT_ALLOWED"
        );
    });

    it("rejects an SVG disguised as PNG (script-capable image)", async () => {
        expectError(
            await send(avatars(), svgBuffer(), "logo.png", "image/png"),
            400,
            "MEDIA_TYPE_NOT_ALLOWED"
        );
    });

    it("rejects a JPEG body sent with a PNG MIME", async () => {
        expectError(
            await send(avatars(), jpegBuffer(), "me.png", "image/png"),
            400,
            "MEDIA_TYPE_NOT_ALLOWED"
        );
    });

    it("rejects a spoofed extension", async () => {
        expectError(
            await send(avatars(), pngBuffer(), "me.exe", "image/png"),
            400,
            "MEDIA_TYPE_NOT_ALLOWED"
        );
    });

    it("rejects a zero-byte file: 400 UPLOAD_INVALID", async () => {
        expectError(
            await send(avatars(), Buffer.alloc(0), "me.png", "image/png"),
            400,
            "UPLOAD_INVALID"
        );
    });

    it("cuts off an oversize file while streaming: 413 FILE_TOO_LARGE", async () => {
        const big = Buffer.concat([pngBuffer(), Buffer.alloc(2 * MB, 1)]);
        expectError(
            await send(avatars(), big, "me.png", "image/png"),
            413,
            "FILE_TOO_LARGE"
        );
    });

    it("accepts a file exactly at the limit boundary region and larger limits for documents", async () => {
        const docs = appFor({ kind: "learning-content" });
        const big = Buffer.concat([pdfBuffer(), Buffer.alloc(3 * MB, 32)]);
        const res = await send(docs, big, "notes.pdf", "application/pdf");
        expect(res.status).toBe(200);
        expect(res.body.files[0].policy).toMatchObject({
            resourceType: "raw",
            delivery: "authenticated",
        });
    });

    it("never accepts video through memory storage (signed direct upload only)", async () => {
        expectError(
            await send(
                appFor({ kind: "learning-content" }),
                mp4Buffer(),
                "clip.mp4",
                "video/mp4"
            ),
            400,
            "MEDIA_TYPE_NOT_ALLOWED"
        );
    });

    it("answers 400 UPLOAD_INVALID when no file is sent, or the request is not multipart", async () => {
        expectError(
            await request(avatars()).post("/upload").field("note", "hi"),
            400,
            "UPLOAD_INVALID"
        );
        expectError(
            await request(avatars()).post("/upload").send({ a: 1 }),
            400,
            "UPLOAD_INVALID"
        );
    });

    it("rejects a file sent under the wrong field name: 400 UPLOAD_INVALID", async () => {
        const res = await request(avatars())
            .post("/upload")
            .attach("avatar", pngBuffer(), {
                filename: "me.png",
                contentType: "image/png",
            });
        expectError(res, 400, "UPLOAD_INVALID");
    });

    it("limits the number of files", async () => {
        const res = await request(avatars())
            .post("/upload")
            .attach("file", pngBuffer(), {
                filename: "a.png",
                contentType: "image/png",
            })
            .attach("file", pngBuffer(), {
                filename: "b.png",
                contentType: "image/png",
            });
        expectError(res, 400, "UPLOAD_INVALID");
    });

    it("accepts several files when maxFiles allows and validates each of them", async () => {
        const app = appFor({ kind: "learning-content", maxFiles: 2 });
        const ok = await request(app)
            .post("/upload")
            .attach("file", pdfBuffer(), {
                filename: "a.pdf",
                contentType: "application/pdf",
            })
            .attach("file", textBuffer(), {
                filename: "b.txt",
                contentType: "text/plain",
            });
        expect(ok.body.files.map((f) => f.policy.format)).toEqual([
            "pdf",
            "txt",
        ]);
        const bad = await request(app)
            .post("/upload")
            .attach("file", pdfBuffer(), {
                filename: "a.pdf",
                contentType: "application/pdf",
            })
            .attach("file", exeBuffer(), {
                filename: "b.txt",
                contentType: "text/plain",
            });
        expectError(bad, 400, "MEDIA_TYPE_NOT_ALLOWED");
    });

    it("sanitises multipart text fields like any other body", async () => {
        const res = await send(avatars(), pngBuffer(), "me.png", "image/png", {
            caption: "hello",
            $where: "1",
            "a.b": "2",
        });
        expect(res.body.body).toEqual({ caption: "hello" });
    });

    it("limits the number of text fields", async () => {
        const fields = Object.fromEntries(
            Array.from({ length: 15 }, (_, i) => [`f${i}`, "v"])
        );
        expectError(
            await send(avatars(), pngBuffer(), "me.png", "image/png", fields),
            400,
            "UPLOAD_INVALID"
        );
    });
});
