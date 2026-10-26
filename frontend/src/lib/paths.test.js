import { describe, expect, it } from "vitest";
import {
    PATHS,
    PATH_ALIASES,
    buildPath,
    isAuthPath,
    isReturnablePath,
} from "@/lib/paths";

describe("paths", () => {
    it("keeps numeric aliases pointing at canonical routes (R3)", () => {
        expect(PATH_ALIASES).toEqual({
            "/403": "/unauthorized",
            "/404": "/not-found",
            "/500": "/server-error",
            "/register": "/signup",
        });
    });

    it("builds paths with encoded parameters", () => {
        expect(
            buildPath(PATHS.courseDetail, { id: "64b7f0c2a1b2c3d4e5f60001" })
        ).toBe("/courses/64b7f0c2a1b2c3d4e5f60001");
        expect(buildPath(PATHS.verifyCertificate, { code: "a/b c" })).toBe(
            "/verify/a%2Fb%20c"
        );
    });

    it("refuses to build a path with a missing parameter", () => {
        expect(() => buildPath(PATHS.courseDetail, {})).toThrow(/id/);
    });

    it("recognises returnable routes", () => {
        for (const path of [
            "/dashboard",
            "/courses/abc",
            "/settings/security",
            "/admin",
            "/admin/users",
            "/trainer/quizzes/1/results",
        ]) {
            expect(isReturnablePath(path)).toBe(true);
        }
    });

    it("rejects auth, state, unknown and non-string paths", () => {
        for (const path of [
            "/",
            "/login",
            "/signup",
            "/session-expired",
            "/unauthorized",
            "/403",
            "/not-a-route",
            "/dashboard/extra/deep",
            undefined,
            5,
        ]) {
            expect(isReturnablePath(path)).toBe(false);
        }
    });

    it("keeps the email-change link pages out of post-login destinations (R2, R38)", () => {
        expect(PATHS.confirmEmailChange).toBe("/confirm-email-change");
        expect(PATHS.undoEmailChange).toBe("/undo-email-change");
        expect(isReturnablePath(PATHS.confirmEmailChange)).toBe(false);
        expect(isReturnablePath(PATHS.undoEmailChange)).toBe(false);
        expect(isAuthPath(PATHS.confirmEmailChange)).toBe(true);
        expect(isAuthPath(PATHS.undoEmailChange)).toBe(true);
    });

    it("detects auth entry pages", () => {
        expect(isAuthPath("/login")).toBe(true);
        expect(isAuthPath("/dashboard")).toBe(false);
    });
});
