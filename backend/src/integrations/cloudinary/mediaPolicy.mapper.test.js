import { describe, expect, it } from "vitest";
import {
    docxBuffer,
    exeBuffer,
    gifBuffer,
    htmlBuffer,
    jpegBuffer,
    makeFile,
    movBuffer,
    mp4Buffer,
    pdfBuffer,
    plainZipBuffer,
    pngBuffer,
    pptxBuffer,
    svgBuffer,
    textBuffer,
    webmBuffer,
    webpBuffer,
} from "#tests/helpers/fileFixtures.js";
import {
    allowedFormatsFor,
    assertSignatureRequest,
    assertUploadFile,
    detectMime,
    FILE_TYPES,
    findRule,
    getKindRules,
    multerLimitFor,
    multerMimesFor,
} from "./mediaPolicy.mapper.js";

const MB = 1024 * 1024;
const DOCX =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX =
    "application/vnd.openxmlformats-officedocument.presentationml.presentation";

describe("detectMime (magic bytes, MEDIA-06)", () => {
    it.each([
        ["jpeg", jpegBuffer, "image/jpeg"],
        ["png", pngBuffer, "image/png"],
        ["webp", webpBuffer, "image/webp"],
        ["pdf", pdfBuffer, "application/pdf"],
        ["mp4", mp4Buffer, "video/mp4"],
        ["mov", movBuffer, "video/quicktime"],
        ["webm", webmBuffer, "video/webm"],
        ["docx", docxBuffer, DOCX],
        ["pptx", pptxBuffer, PPTX],
        ["txt", textBuffer, "text/plain"],
    ])("recognises %s", (_name, make, expected) => {
        expect(detectMime(make())).toBe(expected);
    });

    it.each([
        ["gif", gifBuffer],
        ["exe", exeBuffer],
        ["svg", svgBuffer],
        ["html", htmlBuffer],
        ["generic zip", plainZipBuffer],
    ])("rejects %s", (_name, make) => {
        expect(detectMime(make())).toBeNull();
    });

    it("rejects binary data that merely looks like text, tiny and non-buffer input", () => {
        expect(
            detectMime(Buffer.from([0x41, 0x42, 0x00, 0x43, 0x44, 0x45]))
        ).toBeNull();
        expect(
            detectMime(Buffer.from([0xff, 0xfe, 0xfd, 0xfc, 0xfb]))
        ).toBeNull();
        expect(detectMime(Buffer.from("abc"))).toBeNull();
        expect(detectMime("not a buffer")).toBeNull();
        expect(detectMime(undefined)).toBeNull();
    });

    it("rejects an XML or script payload dressed as text", () => {
        expect(
            detectMime(Buffer.from("  <?xml version='1.0'?><svg/>"))
        ).toBeNull();
        expect(detectMime(Buffer.from("<script>alert(1)</script>"))).toBeNull();
    });
});

describe("kind rules (MEDIA-08)", () => {
    it("matches the rulebook table", () => {
        expect(findRule("avatars", "image/png")).toMatchObject({
            maxBytes: 2 * MB,
            resourceType: "image",
            delivery: "public",
        });
        expect(findRule("marketing", "video/mp4")).toMatchObject({
            maxBytes: 100 * MB,
            direct: true,
        });
        expect(findRule("learning-content", "application/pdf")).toMatchObject({
            maxBytes: 10 * MB,
            resourceType: "raw",
            delivery: "authenticated",
        });
        expect(findRule("certificates", "image/png")).toMatchObject({
            maxBytes: 5 * MB,
            delivery: "authenticated",
        });
        expect(findRule("temp", "image/webp")).toMatchObject({
            delivery: "public",
        });
    });

    it("excludes SVG, GIF, HTML, executables and archives everywhere", () => {
        for (const mime of [
            "image/svg+xml",
            "image/gif",
            "text/html",
            "application/x-msdownload",
            "application/zip",
        ]) {
            for (const kind of [
                "avatars",
                "marketing",
                "learning-content",
                "certificates",
                "temp",
            ])
                expect(findRule(kind, mime)).toBeNull();
        }
    });

    it("limits Multer to small, non-video types", () => {
        expect(multerLimitFor("avatars")).toBe(2 * MB);
        expect(multerLimitFor("learning-content")).toBe(10 * MB);
        expect(multerMimesFor("learning-content")).not.toContain("video/mp4");
        expect(multerMimesFor("avatars")).toEqual([
            "image/jpeg",
            "image/png",
            "image/webp",
        ]);
    });

    it("rejects an unknown kind", () => {
        expect(() => getKindRules("secrets")).toThrowError(
            expect.objectContaining({ code: "VALIDATION_ERROR" })
        );
    });

    it("derives Cloudinary allowed_formats from the rule", () => {
        expect(allowedFormatsFor(findRule("avatars", "image/png"))).toEqual([
            "jpg",
            "png",
            "webp",
        ]);
    });

    it("every allowed MIME has a definition", () => {
        for (const kind of [
            "avatars",
            "marketing",
            "learning-content",
            "certificates",
            "temp",
        ]) {
            for (const rule of getKindRules(kind))
                for (const mime of rule.mimes)
                    expect(FILE_TYPES[mime]).toBeDefined();
        }
    });
});

describe("assertSignatureRequest (MEDIA-07)", () => {
    it("accepts an allowed video within the limit", () => {
        expect(
            assertSignatureRequest({
                kind: "learning-content",
                mime: "video/mp4",
                bytes: 50 * MB,
            }).resourceType
        ).toBe("video");
    });

    it.each([
        [
            "a type outside the kind",
            { kind: "avatars", mime: "video/mp4", bytes: 1000 },
            "MEDIA_TYPE_NOT_ALLOWED",
            400,
        ],
        [
            "an executable",
            { kind: "temp", mime: "application/x-msdownload", bytes: 1000 },
            "MEDIA_TYPE_NOT_ALLOWED",
            400,
        ],
        [
            "an oversize file",
            { kind: "learning-content", mime: "video/mp4", bytes: 101 * MB },
            "MEDIA_TOO_LARGE",
            413,
        ],
        [
            "zero bytes",
            { kind: "learning-content", mime: "video/mp4", bytes: 0 },
            "UPLOAD_INVALID",
            400,
        ],
        [
            "fractional bytes",
            { kind: "learning-content", mime: "video/mp4", bytes: 1.5 },
            "UPLOAD_INVALID",
            400,
        ],
    ])("rejects %s", (_label, input, code, status) => {
        expect(() => assertSignatureRequest(input)).toThrowError(
            expect.objectContaining({ code, statusCode: status })
        );
    });

    it("names contentType, not file, as the field of a disallowed type", () => {
        expect(() =>
            assertSignatureRequest({
                kind: "learning-content",
                mime: "image/gif",
                bytes: 10,
            })
        ).toThrowError(
            expect.objectContaining({
                code: "MEDIA_TYPE_NOT_ALLOWED",
                errors: [expect.objectContaining({ field: "contentType" })],
            })
        );
    });
});

describe("assertUploadFile (MEDIA-06)", () => {
    const avatar = (overrides = {}) =>
        makeFile({
            originalname: "me.png",
            mimetype: "image/png",
            buffer: pngBuffer(),
            ...overrides,
        });

    it("accepts a genuine file and reports what the adapter needs", () => {
        expect(
            assertUploadFile({ kind: "avatars", file: avatar() })
        ).toMatchObject({
            mime: "image/png",
            format: "png",
            resourceType: "image",
            delivery: "public",
        });
    });

    it("accepts jpg and jpeg extensions, and uppercase extensions", () => {
        for (const originalname of ["a.jpg", "a.jpeg", "A.JPG"]) {
            expect(() =>
                assertUploadFile({
                    kind: "avatars",
                    file: avatar({
                        originalname,
                        mimetype: "image/jpeg",
                        buffer: jpegBuffer(),
                    }),
                })
            ).not.toThrow();
        }
    });

    it("rejects a wrong MIME for the kind", () => {
        const file = makeFile({
            originalname: "x.pdf",
            mimetype: "application/pdf",
            buffer: pdfBuffer(),
        });
        expect(() => assertUploadFile({ kind: "avatars", file })).toThrowError(
            expect.objectContaining({ code: "MEDIA_TYPE_NOT_ALLOWED" })
        );
    });

    it("rejects spoofed magic bytes (PNG name and MIME, executable content)", () => {
        expect(() =>
            assertUploadFile({
                kind: "avatars",
                file: avatar({ buffer: exeBuffer() }),
            })
        ).toThrowError(
            expect.objectContaining({ code: "MEDIA_TYPE_NOT_ALLOWED" })
        );
        expect(() =>
            assertUploadFile({
                kind: "avatars",
                file: avatar({ buffer: svgBuffer() }),
            })
        ).toThrow();
    });

    it("rejects a content/MIME mismatch between two allowed types", () => {
        expect(() =>
            assertUploadFile({
                kind: "avatars",
                file: avatar({ buffer: jpegBuffer() }),
            })
        ).toThrowError(
            expect.objectContaining({ code: "MEDIA_TYPE_NOT_ALLOWED" })
        );
    });

    it("rejects a spoofed or missing extension", () => {
        expect(() =>
            assertUploadFile({
                kind: "avatars",
                file: avatar({ originalname: "me.exe" }),
            })
        ).toThrow();
        expect(() =>
            assertUploadFile({
                kind: "avatars",
                file: avatar({ originalname: "noextension" }),
            })
        ).toThrow();
        expect(() =>
            assertUploadFile({
                kind: "avatars",
                file: avatar({ originalname: undefined }),
            })
        ).toThrow();
    });

    it("rejects zero-byte files", () => {
        const empty = {
            originalname: "me.png",
            mimetype: "image/png",
            buffer: Buffer.alloc(0),
            size: 0,
        };
        expect(() =>
            assertUploadFile({ kind: "avatars", file: empty })
        ).toThrowError(expect.objectContaining({ code: "UPLOAD_INVALID" }));
    });

    it("rejects oversize files with 413 FILE_TOO_LARGE", () => {
        const big = { ...avatar(), size: 2 * MB + 1 };
        expect(() =>
            assertUploadFile({ kind: "avatars", file: big })
        ).toThrowError(
            expect.objectContaining({ code: "FILE_TOO_LARGE", statusCode: 413 })
        );
    });

    it("never accepts video through memory storage", () => {
        const file = makeFile({
            originalname: "clip.mp4",
            mimetype: "video/mp4",
            buffer: mp4Buffer(),
        });
        expect(() =>
            assertUploadFile({ kind: "learning-content", file })
        ).toThrowError(
            expect.objectContaining({ code: "MEDIA_TYPE_NOT_ALLOWED" })
        );
    });

    it("accepts learning documents as raw, authenticated assets", () => {
        const docx = makeFile({
            originalname: "notes.docx",
            mimetype: DOCX,
            buffer: docxBuffer(),
        });
        expect(
            assertUploadFile({ kind: "learning-content", file: docx })
        ).toMatchObject({
            resourceType: "raw",
            delivery: "authenticated",
            format: "docx",
        });
        const txt = makeFile({
            originalname: "notes.txt",
            mimetype: "text/plain",
            buffer: textBuffer("Hindi: नमस्ते"),
        });
        expect(
            assertUploadFile({ kind: "learning-content", file: txt }).format
        ).toBe("txt");
    });

    it("handles a missing file object", () => {
        expect(() =>
            assertUploadFile({ kind: "avatars", file: undefined })
        ).toThrowError(
            expect.objectContaining({ code: "MEDIA_TYPE_NOT_ALLOWED" })
        );
    });
});
