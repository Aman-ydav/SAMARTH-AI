import { describe, expect, it } from "vitest";
import {
    ASSIGNABLE_ROLES,
    INVITE_GRANTS,
    ROLES,
    ROLE_SETS,
    grantableRoles,
    hasRole,
    isAdminRole,
    isKnownRole,
    rolesChangeableTo,
    statusActionFor,
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

describe("admin permission mirrors (R68, R69)", () => {
    const platform = { id: "p1", role: "superadmin" };
    const admin = { id: "a1", role: "admin" };

    it("offers only the roles the signed-in role may invite", () => {
        expect(grantableRoles(platform)).toEqual(["trainer", "admin"]);
        expect(grantableRoles(admin)).toEqual(["trainer"]);
        expect(grantableRoles({ role: "trainer" })).toEqual([]);
        expect(grantableRoles({ role: "learner" })).toEqual([]);
        expect(grantableRoles({ role: "root" })).toEqual([]);
        expect(grantableRoles(null)).toEqual([]);
        expect(Object.keys(INVITE_GRANTS).sort()).toEqual([
            "admin",
            "superadmin",
        ]);
    });

    it("never lets superadmin be invited or assigned", () => {
        expect(ASSIGNABLE_ROLES).not.toContain("superadmin");
        expect(grantableRoles(platform)).not.toContain("superadmin");
        expect(grantableRoles(platform)).not.toContain("learner");
    });

    it("offers suspend for active and reactivate for suspended accounts only", () => {
        const learner = { id: "u1", role: "learner" };
        expect(statusActionFor(admin, { ...learner, status: "active" })).toBe(
            "suspend"
        );
        expect(
            statusActionFor(admin, { ...learner, status: "suspended" })
        ).toBe("reactivate");
        expect(
            statusActionFor(admin, {
                ...learner,
                status: "pending_verification",
            })
        ).toBeNull();
        expect(
            statusActionFor(admin, { ...learner, status: "deactivated" })
        ).toBeNull();
    });

    it("hides status actions the API would refuse: self, platform admins and, for an admin, other admins", () => {
        expect(
            statusActionFor(admin, {
                id: "a1",
                role: "admin",
                status: "active",
            })
        ).toBeNull();
        expect(
            statusActionFor(admin, {
                id: "a2",
                role: "admin",
                status: "active",
            })
        ).toBeNull();
        expect(
            statusActionFor(platform, {
                id: "a2",
                role: "admin",
                status: "active",
            })
        ).toBe("suspend");
        expect(
            statusActionFor(platform, {
                id: "p2",
                role: "superadmin",
                status: "active",
            })
        ).toBeNull();
        expect(statusActionFor(null, { id: "x", role: "learner" })).toBeNull();
        expect(
            statusActionFor(
                { role: "trainer", id: "t" },
                {
                    id: "u",
                    role: "learner",
                    status: "active",
                }
            )
        ).toBeNull();
    });

    it("lets only a platform admin change roles, never their own or another platform admin's", () => {
        const trainer = { id: "t1", role: "trainer" };
        expect(rolesChangeableTo(platform, trainer)).toEqual([
            "learner",
            "admin",
        ]);
        expect(rolesChangeableTo(admin, trainer)).toEqual([]);
        expect(
            rolesChangeableTo(platform, { id: "p1", role: "admin" })
        ).toEqual([]);
        expect(
            rolesChangeableTo(platform, { id: "p2", role: "superadmin" })
        ).toEqual([]);
        expect(rolesChangeableTo(null, trainer)).toEqual([]);
        expect(rolesChangeableTo(platform, null)).toEqual([]);
    });
});
