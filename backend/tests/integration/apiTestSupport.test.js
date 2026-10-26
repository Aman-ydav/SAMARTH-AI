import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { User } from "#modules/users/user.model.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import {
    API_TEST_EMAIL_DOMAIN,
    createFixtureDir,
    createRunSecrets,
} from "#tests/setup/apiFixtures.js";
import { patchedSdk } from "#tests/setup/cloudinaryStub.js";
import { seedStaff } from "#tests/setup/seedRoleUsers.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

const sequence = () => {
    let next = 1;
    return (size) => Buffer.alloc(size, next++);
};

describe("test:api run secrets", () => {
    it("generates distinct accounts on the allowed test domain, none of them hard-coded", () => {
        const secrets = createRunSecrets(sequence());
        for (const key of ["adminEmail", "orgAdminEmail", "trainerEmail"]) {
            expect(secrets[key]).toMatch(
                new RegExp(`@${API_TEST_EMAIL_DOMAIN.replace(".", "\\.")}$`)
            );
        }
        const passwords = [
            secrets.adminPassword,
            secrets.orgAdminPassword,
            secrets.trainerPassword,
        ];
        expect(new Set(passwords).size).toBe(3);
        for (const password of passwords) {
            expect(Buffer.byteLength(password)).toBeGreaterThanOrEqual(10);
            expect(Buffer.byteLength(password)).toBeLessThanOrEqual(72);
        }
        expect(secrets.cloudinaryApiSecret).toMatch(/^[a-f0-9]{48}$/);
    });

    it("differs between two real runs (unique per run)", () => {
        expect(createRunSecrets().adminEmail).not.toBe(
            createRunSecrets().adminEmail
        );
    });
});

describe("avatar fixtures", () => {
    it("writes a valid PNG, an oversize file, a spoofed file, an empty file and a GIF, then cleans up", async () => {
        const { dir, cleanup } = await createFixtureDir();
        try {
            const png = await readFile(path.join(dir, "avatar-valid.png"));
            expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
            expect(
                (await stat(path.join(dir, "avatar-too-large.png"))).size
            ).toBeGreaterThan(2 * 1024 * 1024);
            expect(
                (
                    await readFile(path.join(dir, "avatar-spoofed.png"))
                ).toString()
            ).toContain("<svg");
            expect((await stat(path.join(dir, "avatar-empty.png"))).size).toBe(
                0
            );
            expect(
                (
                    await readFile(path.join(dir, "avatar-not-allowed.gif"))
                ).toString()
            ).toMatch(/^GIF89a/);
        } finally {
            await cleanup();
        }
        expect(existsSync(dir)).toBe(false);
    });
});

describe("role users for the media role matrix", () => {
    const staff = [
        {
            email: "trainer@example.test",
            password: "Trainer-Pass-1!x",
            role: "trainer",
            name: "Test Trainer",
        },
        {
            email: "admin@example.test",
            password: "Admin-Pass-1!xyz",
            role: "admin",
            name: "Test Admin",
        },
    ];

    it("creates active, verified accounts that need no password change", async () => {
        await expect(seedStaff(staff)).resolves.toBe(2);
        const trainer = await User.findOne({
            email: "trainer@example.test",
        }).select("+passwordHash");
        expect(trainer).toMatchObject({
            role: "trainer",
            status: "active",
            emailVerified: true,
            mustChangePassword: false,
        });
        expect(trainer.passwordHash).toBeTruthy();
    });

    it("is idempotent and never overwrites an existing password", async () => {
        await seedStaff(staff);
        const before = await User.findOne({
            email: "admin@example.test",
        }).select("+passwordHash");
        await expect(
            seedStaff([{ ...staff[1], password: "Another-Pass-9!x" }])
        ).resolves.toBe(0);
        const after = await User.findOne({
            email: "admin@example.test",
        }).select("+passwordHash");
        expect(after.passwordHash).toBe(before.passwordHash);
        expect(await User.countDocuments({})).toBe(2);
    });
});

describe("Cloudinary stub (loaded only by test:api)", () => {
    const upload = (options, bytes) =>
        new Promise((resolve, reject) => {
            const stream = patchedSdk.uploader.upload_stream(
                options,
                (error, result) => (error ? reject(error) : resolve(result))
            );
            Readable.from([bytes]).pipe(stream);
        });

    it("answers an upload without any network and reports the real size and format", async () => {
        const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
        const result = await upload(
            {
                folder: "samarth-ai/test/avatars",
                public_id: "abc",
                resource_type: "image",
                type: "upload",
                allowed_formats: "jpg,png,webp",
            },
            png
        );
        expect(result).toMatchObject({
            public_id: "samarth-ai/test/avatars/abc",
            format: "png",
            bytes: png.length,
            resource_type: "image",
        });
    });

    it("describes confirmed assets by resource type and treats the temp folder as never uploaded", async () => {
        await expect(
            patchedSdk.api.resource("samarth-ai/test/learning-content/v", {
                resource_type: "video",
                type: "upload",
            })
        ).resolves.toMatchObject({ format: "mp4", duration: 12.5 });
        const raw = await patchedSdk.api.resource(
            "samarth-ai/test/learning-content/d",
            { resource_type: "raw", type: "authenticated" }
        );
        expect(raw.format).toBeUndefined();
        await expect(
            patchedSdk.api.resource("samarth-ai/test/temp/x", {
                resource_type: "image",
                type: "upload",
            })
        ).rejects.toMatchObject({ http_code: 404 });
        await expect(
            patchedSdk.uploader.destroy("anything", {})
        ).resolves.toEqual({ result: "ok" });
    });

    it("keeps the pure signing helpers real", () => {
        const signature = patchedSdk.utils.api_sign_request(
            { timestamp: 1 },
            "secret"
        );
        expect(signature).toMatch(/^[a-f0-9]{40,64}$/);
    });
});
