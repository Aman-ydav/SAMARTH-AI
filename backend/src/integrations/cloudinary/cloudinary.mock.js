import { Writable } from "node:stream";

/**
 * Test double for the Cloudinary SDK (TEST-22, MEDIA-50): no network, no credentials.
 * Only the network-bound parts (`uploader`, `api`) are faked; pure helpers such as `utils.api_sign_request` stay real,
 * so signature tests exercise Cloudinary's own algorithm. Use with `vi.mock("cloudinary", ...)`:
 *
 *   vi.mock("cloudinary", async (importOriginal) =>
 *       (await import("#integrations/cloudinary/cloudinary.mock.js")).buildMockedCloudinaryModule(await importOriginal()));
 */
export function createCloudinaryFake() {
    const fake = {
        configs: [],
        uploads: [],
        destroys: [],
        resources: [],
        uploadError: null,
        uploadResult: null,
        destroyResult: { result: "ok" },
        destroyError: null,
        resourceResult: null,
        resourceError: null,
        reset() {
            Object.assign(fake, {
                configs: [],
                uploads: [],
                destroys: [],
                resources: [],
                uploadError: null,
                uploadResult: null,
                destroyResult: { result: "ok" },
                destroyError: null,
                resourceResult: null,
                resourceError: null,
            });
        },
    };

    fake.uploader = {
        upload_stream(options, callback) {
            const chunks = [];
            const record = { options, bytes: 0 };
            fake.uploads.push(record);
            return new Writable({
                write(chunk, _encoding, done) {
                    chunks.push(chunk);
                    done();
                },
                final(done) {
                    record.bytes = Buffer.concat(chunks).length;
                    setImmediate(() => {
                        if (fake.uploadError) callback(fake.uploadError);
                        else
                            callback(
                                null,
                                fake.uploadResult ?? {
                                    public_id: `${options.folder}/${options.public_id}`,
                                    resource_type: options.resource_type,
                                    type: options.type,
                                    format: "png",
                                    bytes: record.bytes,
                                    width: 100,
                                    height: 100,
                                    secure_url:
                                        "https://media.example.test/asset",
                                    version: 1700000000,
                                }
                            );
                    });
                    done();
                },
            });
        },
        async destroy(publicId, options) {
            fake.destroys.push({ publicId, options });
            if (fake.destroyError) throw fake.destroyError;
            return fake.destroyResult;
        },
    };

    fake.api = {
        async resource(publicId, options) {
            fake.resources.push({ publicId, options });
            if (fake.resourceError) throw fake.resourceError;
            return (
                fake.resourceResult ?? {
                    public_id: publicId,
                    resource_type: options.resource_type,
                    type: options.type,
                    format: "mp4",
                    bytes: 2048,
                    duration: 12.5,
                    secure_url: "https://media.example.test/asset",
                    version: 1700000001,
                }
            );
        },
    };
    return fake;
}

/** Shared instance imported by both the `vi.mock` factory and the test, so the test can steer and inspect it. */
export const cloudinaryFake = createCloudinaryFake();

/** Builds the replacement module: real pure helpers, faked network surface. */
export function buildMockedCloudinaryModule(actual) {
    const v2 = {
        ...actual.v2,
        config: (options) => {
            cloudinaryFake.configs.push(options);
            return actual.v2.config(options);
        },
        uploader: cloudinaryFake.uploader,
        api: cloudinaryFake.api,
    };
    return { ...actual, v2, default: { ...actual.default, v2 } };
}
