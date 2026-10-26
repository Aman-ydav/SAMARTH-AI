import { describe, expect, it } from "vitest";
import {
    buildFolder,
    cloudinaryEnvName,
    generatePublicId,
} from "./folders.mapper.js";

describe("cloudinaryEnvName (MEDIA-04)", () => {
    it("maps NODE_ENV to dev, test or prod", () => {
        expect(cloudinaryEnvName("development")).toBe("dev");
        expect(cloudinaryEnvName("test")).toBe("test");
        expect(cloudinaryEnvName("production")).toBe("prod");
    });

    it("uses the validated environment by default", () => {
        expect(cloudinaryEnvName()).toBe("test");
    });
});

describe("buildFolder", () => {
    it("builds samarth-ai/{env}/{kind} for every kind", () => {
        for (const kind of [
            "avatars",
            "marketing",
            "learning-content",
            "certificates",
            "temp",
        ]) {
            expect(buildFolder(kind, "production")).toBe(
                `samarth-ai/prod/${kind}`
            );
        }
        expect(buildFolder("avatars", "development")).toBe(
            "samarth-ai/dev/avatars"
        );
        expect(buildFolder("avatars")).toBe("samarth-ai/test/avatars");
    });

    it("rejects unknown kinds, including path tricks", () => {
        for (const kind of [
            "legacy-project",
            "../avatars",
            "avatars/../x",
            "",
            undefined,
        ]) {
            expect(() => buildFolder(kind)).toThrowError(
                expect.objectContaining({ statusCode: 400 })
            );
        }
    });
});

describe("generatePublicId (MEDIA-04a)", () => {
    it("is random, URL-safe and never contains path separators", () => {
        const a = generatePublicId();
        expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
        expect(generatePublicId()).not.toBe(a);
    });

    it("can be prefixed with the owner id", () => {
        expect(
            generatePublicId({ ownerId: "507f1f77bcf86cd799439011" })
        ).toMatch(/^507f1f77bcf86cd799439011_[A-Za-z0-9_-]{22}$/);
    });
});
