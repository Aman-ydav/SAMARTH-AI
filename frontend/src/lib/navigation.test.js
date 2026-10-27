import { describe, expect, it } from "vitest";
import * as icons from "@/components/icons";
import enNav from "@/i18n/locales/en/nav.json";
import hiNav from "@/i18n/locales/hi/nav.json";
import {
    MARKETING_LINKS,
    NAV_GROUPS,
    NAV_ITEMS,
    getBreadcrumbs,
    getDisplayName,
    getNavGroups,
    getNavItems,
    getNextSteps,
    isNavItemActive,
} from "@/lib/navigation";
import { PATHS } from "@/lib/paths";
import { ROLES } from "@/lib/permissions";

const user = (role) => ({ role });
const ids = (role) => getNavItems(user(role)).map((entry) => entry.id);
const lookup = (tree, path) =>
    path.split(".").reduce((node, key) => node?.[key], tree);
const identity = (key) => key;

describe("navigation config integrity", () => {
    it("references only icons that exist in the registry", () => {
        for (const entry of NAV_ITEMS)
            expect(icons[entry.icon], entry.id).toBeTypeOf("function");
    });

    it("has a label in English and Hindi for every item, group and marketing link", () => {
        const keys = [
            ...NAV_ITEMS.map((entry) => entry.labelKey),
            ...NAV_GROUPS.map((group) => group.labelKey),
            ...MARKETING_LINKS.map((link) => link.labelKey),
        ];
        for (const key of keys) {
            expect(lookup(enNav, key), `en ${key}`).toBeTypeOf("string");
            expect(lookup(hiNav, key), `hi ${key}`).toBeTypeOf("string");
        }
    });

    it("uses unique ids and unique concrete paths", () => {
        expect(new Set(NAV_ITEMS.map((entry) => entry.id)).size).toBe(
            NAV_ITEMS.length
        );
        expect(new Set(NAV_ITEMS.map((entry) => entry.to)).size).toBe(
            NAV_ITEMS.length
        );
        for (const entry of NAV_ITEMS) expect(entry.to).not.toContain(":");
    });

    it("keeps the public navbar to five links", () => {
        expect(MARKETING_LINKS.length).toBeLessThanOrEqual(5);
    });

    it("freezes the config so it cannot be mutated at runtime", () => {
        expect(Object.isFrozen(NAV_ITEMS)).toBe(true);
        expect(Object.isFrozen(NAV_ITEMS[0])).toBe(true);
        expect(Object.isFrozen(NAV_ITEMS[0].roles)).toBe(true);
    });
});

describe("planned flags", () => {
    it("marks only the built destinations as ready", () => {
        const ready = NAV_ITEMS.filter((entry) => !entry.planned).map(
            (entry) => entry.id
        );
        expect(ready.sort()).toEqual([
            "dashboard",
            "invites",
            "settings",
            "users",
        ]);
    });
});

describe("role filtering (hidden, never disabled)", () => {
    it("shows a learner the learner items plus account items and nothing administrative", () => {
        const visible = ids(ROLES.LEARNER);
        expect(visible).toContain("dashboard");
        expect(visible).toContain("gaps");
        expect(visible).toContain("settings");
        expect(visible).not.toContain("users");
        expect(visible).not.toContain("content");
        expect(visible).not.toContain("organisations");
        const paths = getNavItems(user(ROLES.LEARNER)).map((entry) => entry.to);
        expect(paths.some((path) => path.startsWith("/admin"))).toBe(false);
        expect(paths.some((path) => path.startsWith("/superadmin"))).toBe(
            false
        );
    });

    it("shows a trainer the trainer items but no admin items", () => {
        const visible = ids(ROLES.TRAINER);
        expect(visible).toEqual(
            expect.arrayContaining(["content", "generate", "review"])
        );
        expect(visible).not.toContain("users");
        expect(visible).not.toContain("gaps");
    });

    it("shows an admin the admin group but not the platform group", () => {
        const visible = ids(ROLES.ADMIN);
        expect(visible).toEqual(
            expect.arrayContaining(["adminOverview", "users", "audit"])
        );
        expect(visible).not.toContain("organisations");
        expect(visible).not.toContain("framework");
    });

    it("shows a superadmin the platform group as well", () => {
        const visible = ids(ROLES.SUPERADMIN);
        expect(visible).toEqual(
            expect.arrayContaining([
                "organisations",
                "framework",
                "system",
                "users",
            ])
        );
    });

    it.each([
        [undefined],
        [null],
        [{}],
        [{ role: "wizard" }],
        [{ role: "ADMIN" }],
    ])("shows nothing for the unknown user %j", (value) => {
        expect(getNavItems(value)).toEqual([]);
        expect(getNavGroups(value)).toEqual([]);
    });

    it("returns ordered, non-empty groups", () => {
        const groups = getNavGroups(user(ROLES.ADMIN));
        expect(groups.map((group) => group.id)).toEqual([
            "main",
            "admin",
            "account",
        ]);
        for (const group of groups)
            expect(group.items.length).toBeGreaterThan(0);
    });
});

describe("isNavItemActive", () => {
    const byId = (id) => NAV_ITEMS.find((entry) => entry.id === id);

    it("matches exact items only on their own path", () => {
        expect(isNavItemActive(byId("adminOverview"), "/admin")).toBe(true);
        expect(isNavItemActive(byId("adminOverview"), "/admin/users")).toBe(
            false
        );
        expect(isNavItemActive(byId("dashboard"), "/dashboard")).toBe(true);
    });

    it("matches nested paths for prefix items", () => {
        expect(
            isNavItemActive(
                byId("content"),
                "/trainer/content/64b7f0c2a1b2c3d4e5f60001"
            )
        ).toBe(true);
        expect(isNavItemActive(byId("content"), "/trainer/contentious")).toBe(
            false
        );
    });

    it("treats every settings page as the settings item", () => {
        expect(isNavItemActive(byId("settings"), "/settings/sessions")).toBe(
            true
        );
        expect(isNavItemActive(byId("settings"), "/settings")).toBe(true);
    });

    it("never matches a non-string path", () => {
        expect(isNavItemActive(byId("gaps"), undefined)).toBe(false);
    });
});

describe("getBreadcrumbs", () => {
    const admin = user(ROLES.ADMIN);

    it("is only the current page on the dashboard", () => {
        expect(
            getBreadcrumbs(PATHS.dashboard, admin, "Dashboard", identity)
        ).toEqual([{ id: "current", label: "Dashboard", to: null }]);
    });

    it("starts at the dashboard and includes ancestor sections", () => {
        const trail = getBreadcrumbs(
            PATHS.adminUsers,
            admin,
            "Users",
            identity
        );
        expect(trail.map((crumb) => crumb.id)).toEqual([
            "dashboard",
            "adminOverview",
            "current",
        ]);
        expect(trail.at(-1).to).toBeNull();
        expect(trail[0].to).toBe(PATHS.dashboard);
    });

    it("drops an ancestor whose label equals the current page", () => {
        const trail = getBreadcrumbs(
            "/trainer/quizzes/64b7f0c2a1b2c3d4e5f60001/results",
            user(ROLES.TRAINER),
            "sidebar.trainerQuizzes",
            identity
        );
        expect(trail.map((crumb) => crumb.label)).toEqual([
            "sidebar.dashboard",
            "sidebar.trainerQuizzes",
        ]);
    });

    it("omits crumbs the user cannot see", () => {
        const trail = getBreadcrumbs(
            "/admin/users",
            user(ROLES.LEARNER),
            "Users",
            identity
        );
        expect(trail.map((crumb) => crumb.id)).toEqual([
            "dashboard",
            "current",
        ]);
    });

    it("has no current crumb when the title is unknown", () => {
        const trail = getBreadcrumbs(
            PATHS.gaps,
            user(ROLES.LEARNER),
            "",
            identity
        );
        expect(trail.map((crumb) => crumb.id)).toEqual(["dashboard"]);
    });
});

describe("getNextSteps", () => {
    it.each([
        [ROLES.LEARNER, ["competencies", "gaps", "recommendations", "path"]],
        [ROLES.TRAINER, ["content", "generate", "review"]],
        [ROLES.ADMIN, ["users", "invites", "audit"]],
        [
            ROLES.SUPERADMIN,
            ["users", "invites", "organisations", "framework", "system"],
        ],
    ])("suggests role-appropriate areas for %s", (role, expected) => {
        const steps = getNextSteps(user(role));
        expect(steps.map((entry) => entry.id)).toEqual(expected);
        for (const entry of steps)
            expect(lookup(enNav, entry.descriptionKey)).toBeTypeOf("string");
    });

    it("suggests nothing for an unknown user", () => {
        expect(getNextSteps(undefined)).toEqual([]);
        expect(getNextSteps({ role: "wizard" })).toEqual([]);
    });
});

describe("getDisplayName", () => {
    it("prefers the trimmed name, then the email local part", () => {
        expect(
            getDisplayName({ name: "  Asha Verma ", email: "a@example.test" })
        ).toBe("Asha Verma");
        expect(
            getDisplayName({ name: "", email: "asha.verma@example.test" })
        ).toBe("asha.verma");
        expect(getDisplayName({ name: 42, email: null })).toBe("");
        expect(getDisplayName(null)).toBe("");
    });
});
