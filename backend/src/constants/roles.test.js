import { describe, expect, it } from "vitest";
import { INVITABLE_ROLES, ROLE_LIST, ROLES } from "./roles.js";

describe("roles", () => {
    it("lists exactly the four roles of AUTH-59, frozen", () => {
        expect(ROLE_LIST).toEqual([
            "learner",
            "trainer",
            "admin",
            "superadmin",
        ]);
        expect(Object.isFrozen(ROLES)).toBe(true);
        expect(Object.isFrozen(ROLE_LIST)).toBe(true);
    });

    it("never lets an invite grant superadmin", () => {
        expect(INVITABLE_ROLES).not.toContain("superadmin");
        expect(INVITABLE_ROLES).toContain("learner");
    });
});
