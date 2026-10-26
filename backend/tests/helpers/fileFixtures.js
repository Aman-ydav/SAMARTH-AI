/** Tiny in-memory files with correct magic bytes, for upload and media-policy tests. No binaries are committed (FS-07). */
const pad = (head, total = 64) =>
    Buffer.concat([head, Buffer.alloc(Math.max(0, total - head.length), 0x20)]);

export const jpegBuffer = () =>
    pad(
        Buffer.from([
            0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
        ])
    );
export const pngBuffer = () =>
    pad(
        Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
            0x0d,
        ])
    );
export const webpBuffer = () =>
    pad(
        Buffer.concat([
            Buffer.from("RIFF"),
            Buffer.from([0x24, 0, 0, 0]),
            Buffer.from("WEBPVP8 "),
        ])
    );
export const pdfBuffer = () => pad(Buffer.from("%PDF-1.7\n"));
export const gifBuffer = () => pad(Buffer.from("GIF89a"));
export const exeBuffer = () => pad(Buffer.from("MZ\x90\x00\x03\x00"));
export const svgBuffer = () =>
    pad(
        Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
        )
    );
export const htmlBuffer = () =>
    pad(Buffer.from("<!DOCTYPE html><html><body>hi</body></html>"));
export const mp4Buffer = () =>
    pad(Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom")]));
export const movBuffer = () =>
    pad(Buffer.concat([Buffer.from([0, 0, 0, 0x14]), Buffer.from("ftypqt  ")]));
export const webmBuffer = () =>
    pad(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42]));
export const textBuffer = (text = "Plain learning notes.\n") =>
    Buffer.from(text, "utf8");
export const docxBuffer = () =>
    pad(
        Buffer.concat([
            Buffer.from([0x50, 0x4b, 0x03, 0x04]),
            Buffer.from("[Content_Types].xml word/document.xml"),
        ])
    );
export const pptxBuffer = () =>
    pad(
        Buffer.concat([
            Buffer.from([0x50, 0x4b, 0x03, 0x04]),
            Buffer.from("[Content_Types].xml ppt/presentation.xml"),
        ])
    );
export const plainZipBuffer = () =>
    pad(
        Buffer.concat([
            Buffer.from([0x50, 0x4b, 0x03, 0x04]),
            Buffer.from("archive/readme.txt"),
        ])
    );

/** A Multer-style in-memory file object. */
export const makeFile = ({ originalname, mimetype, buffer }) => ({
    originalname,
    mimetype,
    buffer,
    size: buffer.length,
});
