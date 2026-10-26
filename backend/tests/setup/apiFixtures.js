import { randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/** The one email domain the test:api server accepts (ALLOWED_EMAIL_DOMAINS), so the collection can prove DOMAIN_NOT_ALLOWED. */
export const API_TEST_EMAIL_DOMAIN = "example.test";

const TWO_MB = 2 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
// A real 1x1 PNG (67 bytes), so a human opening the sample sees a valid image.
const TINY_PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
);

/**
 * Files the "PUT /me/avatar" requests upload (formdata `src` is relative to newman's working directory).
 * They are generated per run in a temporary folder, so no binary is committed (FS-07).
 */
export const AVATAR_FIXTURES = Object.freeze({
    "avatar-valid.png": () => TINY_PNG,
    "avatar-too-large.png": () =>
        Buffer.concat([PNG_SIGNATURE, Buffer.alloc(TWO_MB, 0x20)]),
    "avatar-spoofed.png": () =>
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    "avatar-empty.png": () => Buffer.alloc(0),
    "avatar-not-allowed.gif": () => Buffer.from("GIF89a-not-an-avatar"),
});

/** Writes the avatar fixtures to a fresh temp folder. Returns `{ dir, cleanup }`. */
export async function createFixtureDir() {
    const dir = await mkdtemp(path.join(tmpdir(), "samarth-api-"));
    for (const [name, build] of Object.entries(AVATAR_FIXTURES)) {
        await writeFile(path.join(dir, name), build());
    }
    return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

/**
 * Credentials generated for ONE run: a seeded superadmin (must change its password on first login), an admin and a
 * trainer (so the role matrix of the media routes can be proven) and the Cloudinary API secret the stubbed SDK signs
 * with. They exist only in the server environment and in newman `--env-var` values, never in a file (TEST-33, TEST-41).
 */
export function createRunSecrets(random = (size) => randomBytes(size)) {
    const token = (size) => random(size).toString("base64url");
    const suffix = random(4).toString("hex");
    return {
        adminEmail: `admin-${suffix}@${API_TEST_EMAIL_DOMAIN}`,
        adminPassword: `Sa!${token(12)}-9x`,
        orgAdminEmail: `orgadmin-${suffix}@${API_TEST_EMAIL_DOMAIN}`,
        orgAdminPassword: `Oa!${token(12)}-7y`,
        trainerEmail: `trainer-${suffix}@${API_TEST_EMAIL_DOMAIN}`,
        trainerPassword: `Tr!${token(12)}-5z`,
        cloudinaryApiSecret: random(24).toString("hex"),
    };
}
