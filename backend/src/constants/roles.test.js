import { describe, expect, it } from "vitest";
import {
    INVITABLE_ROLES,
    INVITE_BODY_ROLES,
    INVITE_GRANTS,
    ROLE_LABELS,
    ROLE_LIST,
    ROLES,
} from "./roles.js";

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

    it("lets a platform admin invite trainers and admins, an admin invite trainers, and nobody else invite (R68)", () => {
        expect(INVITE_GRANTS).toEqual({
            superadmin: ["trainer", "admin"],
            admin: ["trainer"],
        });
        expect(INVITE_GRANTS.learner).toBeUndefined();
        expect(INVITE_GRANTS.trainer).toBeUndefined();
        expect(INVITE_BODY_ROLES).toEqual(["trainer", "admin"]);
        for (const roles of Object.values(INVITE_GRANTS))
            expect(roles).not.toContain("superadmin");
        expect(Object.isFrozen(INVITE_GRANTS)).toBe(true);
        expect(Object.isFrozen(INVITE_GRANTS.admin)).toBe(true);
    });

    it("calls the internal superadmin role the Platform admin on screen", () => {
        expect(ROLE_LABELS.superadmin).toBe("Platform admin");
        expect(Object.keys(ROLE_LABELS)).toEqual(ROLE_LIST);
    });
});
