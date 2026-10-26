import { createRequire } from "node:module";
import { Writable } from "node:stream";

// Preloaded with `node --import` by the test:api runner ONLY. It replaces the network-facing parts of the Cloudinary SDK
// in the API server process, so Postman can exercise avatar upload, confirm, access and delete offline (TEST-22, MEDIA-50).
// Signing and webhook verification stay real (pure functions of the configured secret). Never loaded in dev or production.
const { v2 } = createRequire(import.meta.url)("cloudinary");

/** The patched SDK object, exported so the stub's own test can inspect it. */
export const patchedSdk = v2;

const FIXED_VERSION = 1_700_000_000;
const startsWith = (buffer, bytes) =>
    bytes.every((byte, index) => buffer[index] === byte);

function detectFormat(buffer, allowedFormats) {
    if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47])) return "png";
    if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "jpg";
    if (buffer.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
    return String(allowedFormats ?? "png").split(",")[0];
}

// A direct-upload asset is "uploaded" with a format that follows its resource type; raw files carry no format.
const FORMAT_BY_RESOURCE_TYPE = Object.freeze({ image: "png", video: "mp4" });
// Assets in the temp folder behave as "the browser never uploaded anything": Cloudinary answers 404 for them.
const NEVER_UPLOADED_FOLDER = "/temp/";

v2.uploader.upload_stream = (options, callback) => {
    const chunks = [];
    return new Writable({
        write(chunk, _encoding, done) {
            chunks.push(chunk);
            done();
        },
        final(done) {
            const buffer = Buffer.concat(chunks);
            setImmediate(() =>
                callback(null, {
                    public_id: `${options.folder}/${options.public_id}`,
                    resource_type: options.resource_type,
                    type: options.type,
                    format: detectFormat(buffer, options.allowed_formats),
                    bytes: buffer.length,
                    width: 1,
                    height: 1,
                    secure_url: `https://media.example.test/${options.public_id}`,
                    version: FIXED_VERSION,
                })
            );
            done();
        },
    });
};

v2.uploader.destroy = async () => ({ result: "ok" });

v2.api.resource = async (publicId, options) => {
    if (publicId.includes(NEVER_UPLOADED_FOLDER)) {
        throw Object.assign(new Error("Resource not found"), {
            http_code: 404,
        });
    }
    return {
        public_id: publicId,
        resource_type: options.resource_type,
        type: options.type,
        format: FORMAT_BY_RESOURCE_TYPE[options.resource_type],
        bytes: 2048,
        duration: options.resource_type === "video" ? 12.5 : undefined,
        secure_url: `https://media.example.test/${publicId}`,
        version: FIXED_VERSION,
    };
};
