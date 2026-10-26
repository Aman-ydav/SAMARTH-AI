import { describe, expect, it } from "vitest";
import {
    ROLES,
    ROLE_SETS,
    hasRole,
    isAdminRole,
    isKnownRole,
} from "@/lib/permissions";

describe("permissions", () => {
    it("matches only explicitly listed roles (no hierarchy)", () => {
        expect(hasRole({ role: "admin" }, ROLE_SETS.admin)).toBe(true);
        expect(hasRole({ role: "admin" }, ROLE_SETS.superadmin)).toBe(false);
        expect(hasRole({ role: "superadmin" }, ROLE_SETS.trainer)).toBe(false);
        expect(hasRole({ role: "learner" }, [ROLES.LEARNER])).toBe(true);
    });

    it("never matches unknown roles, missing users or non-array lists", () => {
        expect(hasRole({ role: "root" }, ["root"])).toBe(false);
        expect(hasRole(null, ROLE_SETS.all)).toBe(false);
        expect(hasRole({ role: "learner" }, "learner")).toBe(false);
    });

    it("knows the four roles", () => {
        expect(isKnownRole("trainer")).toBe(true);
        expect(isKnownRole("guest")).toBe(false);
        expect(isAdminRole({ role: "superadmin" })).toBe(true);
        expect(isAdminRole({ role: "learner" })).toBe(false);
    });
});
