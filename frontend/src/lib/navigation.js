import { PATHS } from "@/lib/paths";
import { ROLES, ROLE_SETS, hasRole } from "@/lib/permissions";

/*
 * One navigation config for the whole product (docs/23 section 2.2 and 2.3, UI-60, UI-61).
 * Labels are i18n keys inside the `nav` namespace; icons are names from the registry in `@/components/icons`
 * (this file stays free of component imports). Client-side role filtering is UX only: guards and the API enforce access.
 */

const { LEARNER, TRAINER, ADMIN, SUPERADMIN } = ROLES;
const ADMINS = [ADMIN, SUPERADMIN];

/** Public links in the marketing navbar and mobile menu: at most five (UI-60). `hash` targets a landing section. */
export const MARKETING_LINKS = Object.freeze([
    { id: "how", labelKey: "howItWorks", to: PATHS.home, hash: "#how" },
    { id: "features", labelKey: "features", to: PATHS.home, hash: "#features" },
    {
        id: "security",
        labelKey: "security",
        to: PATHS.home,
        hash: "#security",
    },
    { id: "about", labelKey: "about", to: PATHS.about },
    { id: "faq", labelKey: "faq", to: PATHS.home, hash: "#faq" },
]);

/** Sidebar groups in display order. `labelKey` is a `nav` key. */
export const NAV_GROUPS = Object.freeze([
    { id: "main", labelKey: "group.main" },
    { id: "learn", labelKey: "group.learn" },
    { id: "trainer", labelKey: "group.trainer" },
    { id: "admin", labelKey: "group.admin" },
    { id: "superadmin", labelKey: "group.superadmin" },
    { id: "account", labelKey: "group.account" },
]);

/*
 * Rows are [id, route, icon, roles, group, extra]; the label key is `sidebar.<id>`. `exact` items are active only
 * on their own path, the others on their path and anything below it (or below `activePrefix`). `planned` marks
 * destinations that still render the coming-soon page.
 */
const ALL = ROLE_SETS.all;
const ROWS = [
    [
        "dashboard",
        PATHS.dashboard,
        "DashboardPanelIcon",
        ALL,
        "main",
        { exact: true, planned: false },
    ],
    ["competencies", PATHS.competencies, "RadarIcon", [LEARNER], "learn"],
    ["gaps", PATHS.gaps, "TargetIcon", [LEARNER], "learn"],
    [
        "recommendations",
        PATHS.recommendations,
        "LightbulbIcon",
        [LEARNER],
        "learn",
    ],
    ["path", PATHS.path, "RouteIcon", [LEARNER], "learn"],
    ["quizzes", PATHS.quizzes, "QuizIcon", [LEARNER], "learn"],
    ["labs", PATHS.labs, "LabIcon", [LEARNER], "learn"],
    ["tutor", PATHS.chat, "ChatIcon", [LEARNER], "learn"],
    ["content", PATHS.trainerContent, "FolderOpenIcon", [TRAINER], "trainer"],
    ["generate", PATHS.trainerGenerate, "MagicIcon", [TRAINER], "trainer"],
    ["review", PATHS.trainerQuestions, "EditBoxIcon", [TRAINER], "trainer"],
    [
        "trainerQuizzes",
        PATHS.trainerQuizzes,
        "BarChartBoxIcon",
        [TRAINER],
        "trainer",
    ],
    [
        "adminOverview",
        PATHS.admin,
        "DashboardPanelIcon",
        ADMINS,
        "admin",
        { exact: true },
    ],
    ["analytics", PATHS.adminAnalytics, "PieChartIcon", ADMINS, "admin"],
    [
        "users",
        PATHS.adminUsers,
        "UsersIcon",
        ADMINS,
        "admin",
        { planned: false },
    ],
    [
        "invites",
        PATHS.adminInvites,
        "MailSendIcon",
        ADMINS,
        "admin",
        { planned: false },
    ],
    ["departments", PATHS.adminDepartments, "BuildingIcon", ADMINS, "admin"],
    ["audit", PATHS.adminAudit, "ShieldIcon", ADMINS, "admin"],
    ["integrations", PATHS.adminIntegrations, "PlugIcon", ADMINS, "admin"],
    ["adminSettings", PATHS.adminSettings, "SettingsAltIcon", ADMINS, "admin"],
    [
        "organisations",
        PATHS.superadminOrganisations,
        "GovernmentIcon",
        [SUPERADMIN],
        "superadmin",
    ],
    [
        "framework",
        PATHS.superadminFramework,
        "BranchIcon",
        [SUPERADMIN],
        "superadmin",
    ],
    [
        "system",
        PATHS.superadminSystem,
        "ServerIcon",
        [SUPERADMIN],
        "superadmin",
    ],
    ["notifications", PATHS.notifications, "BellIcon", ALL, "account"],
    [
        "settings",
        PATHS.settingsProfile,
        "UserSettingsIcon",
        ALL,
        "account",
        { activePrefix: "/settings", planned: false },
    ],
];

export const NAV_ITEMS = Object.freeze(
    ROWS.map(([id, to, icon, roles, group, extra = {}]) =>
        Object.freeze({
            id,
            labelKey: `sidebar.${id}`,
            to,
            icon,
            roles: Object.freeze([...roles]),
            group,
            planned: true,
            ...extra,
        })
    )
);

/** Which nav items lead the "what comes next" cards on the dashboard, per role, with their description key. */
const NEXT_STEPS = Object.freeze({
    [LEARNER]: [
        { id: "competencies", descriptionKey: "dashboard.steps.competencies" },
        { id: "gaps", descriptionKey: "dashboard.steps.gaps" },
        {
            id: "recommendations",
            descriptionKey: "dashboard.steps.recommendations",
        },
        { id: "path", descriptionKey: "dashboard.steps.path" },
    ],
    [TRAINER]: [
        { id: "content", descriptionKey: "dashboard.steps.content" },
        { id: "generate", descriptionKey: "dashboard.steps.generate" },
        { id: "review", descriptionKey: "dashboard.steps.review" },
    ],
    [ADMIN]: [
        { id: "users", descriptionKey: "dashboard.steps.users" },
        { id: "invites", descriptionKey: "dashboard.steps.invites" },
        { id: "audit", descriptionKey: "dashboard.steps.audit" },
    ],
    [SUPERADMIN]: [
        { id: "users", descriptionKey: "dashboard.steps.users" },
        { id: "invites", descriptionKey: "dashboard.steps.invites" },
        {
            id: "organisations",
            descriptionKey: "dashboard.steps.organisations",
        },
        { id: "framework", descriptionKey: "dashboard.steps.framework" },
        { id: "system", descriptionKey: "dashboard.steps.system" },
    ],
});

/** Items a role may see, in config order. Unknown or missing roles see nothing (hidden, never disabled). */
export function getNavItems(user) {
    return NAV_ITEMS.filter((entry) => hasRole(user, entry.roles));
}

/** Role-filtered items arranged in the ordered, non-empty groups the sidebar renders. */
export function getNavGroups(user) {
    const items = getNavItems(user);
    return NAV_GROUPS.map((group) => ({
        ...group,
        items: items.filter((entry) => entry.group === group.id),
    })).filter((group) => group.items.length > 0);
}

/** True when `pathname` belongs to the item (own path, or anything under its path or `activePrefix`). */
export function isNavItemActive(entry, pathname) {
    if (typeof pathname !== "string") return false;
    if (pathname === entry.to) return true;
    if (entry.exact) return false;
    const prefix = entry.activePrefix ?? entry.to;
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Breadcrumb trail for the topbar: the dashboard, then any nav items whose path is an ancestor of `pathname`,
 * then the current page. `currentLabel` is the already-translated title of the current page. Only the
 * ancestors carry a `to`; the last crumb is the current page. Ancestors are limited to items the user may see.
 */
export function getBreadcrumbs(pathname, user, currentLabel, t) {
    const visible = getNavItems(user);
    const trail = [];
    if (pathname !== PATHS.dashboard) {
        const home = visible.find((entry) => entry.id === "dashboard");
        if (home)
            trail.push({ id: home.id, label: t(home.labelKey), to: home.to });
    }
    const ancestors = visible
        .filter(
            (entry) =>
                entry.id !== "dashboard" &&
                entry.to !== pathname &&
                pathname.startsWith(`${entry.to}/`)
        )
        .sort((a, b) => a.to.length - b.to.length);
    for (const entry of ancestors) {
        const label = t(entry.labelKey);
        if (label !== currentLabel)
            trail.push({ id: entry.id, label, to: entry.to });
    }
    if (currentLabel)
        trail.push({ id: "current", label: currentLabel, to: null });
    return trail;
}

/** Name to show for a user; falls back to the part of the email before "@" so a label is never blank (EDGE-44). */
export function getDisplayName(user) {
    const name = typeof user?.name === "string" ? user.name.trim() : "";
    if (name) return name;
    const email = typeof user?.email === "string" ? user.email : "";
    return email.split("@")[0] ?? "";
}

/** Nav items (plus a `descriptionKey`) the dashboard suggests for this role. Only items the role may see are returned. */
export function getNextSteps(user) {
    const visible = getNavItems(user);
    return (NEXT_STEPS[user?.role] ?? [])
        .map((step) => {
            const entry = visible.find((candidate) => candidate.id === step.id);
            return entry
                ? { ...entry, descriptionKey: step.descriptionKey }
                : null;
        })
        .filter(Boolean);
}
