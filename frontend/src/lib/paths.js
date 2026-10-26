import { matchPath } from "react-router";

/** Single source of truth for route paths (FE-71, route authority: doc 23 section 2 + R3). */
export const PATHS = Object.freeze({
    home: "/",
    about: "/about",
    privacy: "/privacy",
    terms: "/terms",
    getStarted: "/get-started",
    login: "/login",
    signup: "/signup",
    forgotPassword: "/forgot-password",
    resetPassword: "/reset-password",
    verifyEmail: "/verify-email",
    verifyEmailSent: "/verify-email-sent",
    confirmEmailChange: "/confirm-email-change",
    undoEmailChange: "/undo-email-change",
    acceptInvite: "/accept-invite",
    sessionExpired: "/session-expired",
    changePassword: "/change-password",
    ssoCallback: "/sso/callback",
    verifyCertificate: "/verify/:code",
    unauthorized: "/unauthorized",
    notFound: "/not-found",
    serverError: "/server-error",
    maintenance: "/maintenance",
    offline: "/offline",
    accountSuspended: "/account-suspended",
    accountLocked: "/account-locked",
    accountDeactivated: "/account-deactivated",
    cookiesDisabled: "/cookies-disabled",
    comingSoon: "/coming-soon",
    onboarding: "/onboarding",
    dashboard: "/dashboard",
    competencies: "/competencies",
    gaps: "/gaps",
    recommendations: "/recommendations",
    path: "/path",
    courses: "/courses",
    courseDetail: "/courses/:id",
    enrolments: "/enrolments",
    quizzes: "/quizzes",
    quizDetail: "/quizzes/:id",
    attempt: "/attempts/:id",
    result: "/results/:id",
    practice: "/practice",
    chat: "/chat",
    labs: "/labs",
    notifications: "/notifications",
    settingsProfile: "/settings/profile",
    settingsSecurity: "/settings/security",
    settingsSessions: "/settings/sessions",
    settingsNotifications: "/settings/notifications",
    settingsLanguage: "/settings/language",
    trainerContent: "/trainer/content",
    trainerContentDetail: "/trainer/content/:id",
    trainerGenerate: "/trainer/generate",
    trainerQuestions: "/trainer/questions",
    trainerQuizzes: "/trainer/quizzes",
    trainerQuizResults: "/trainer/quizzes/:id/results",
    admin: "/admin",
    adminAnalytics: "/admin/analytics",
    adminUsers: "/admin/users",
    adminInvites: "/admin/invites",
    adminDepartments: "/admin/departments",
    adminAudit: "/admin/audit",
    adminIntegrations: "/admin/integrations",
    adminSettings: "/admin/settings",
    superadminOrganisations: "/superadmin/organisations",
    superadminFramework: "/superadmin/framework",
    superadminSystem: "/superadmin/system",
});

/** Numeric and legacy aliases: they only redirect to the canonical route (R3). */
export const PATH_ALIASES = Object.freeze({
    "/403": PATHS.unauthorized,
    "/404": PATHS.notFound,
    "/500": PATHS.serverError,
    "/register": PATHS.signup,
});

export const DEFAULT_HOME_PATH = PATHS.dashboard;

/** Routes that must never be a post-login destination (auth entry, email-link and state pages). */
const NON_RETURNABLE = [
    PATHS.home,
    PATHS.login,
    PATHS.signup,
    PATHS.forgotPassword,
    PATHS.resetPassword,
    PATHS.verifyEmail,
    PATHS.verifyEmailSent,
    PATHS.confirmEmailChange,
    PATHS.undoEmailChange,
    PATHS.acceptInvite,
    PATHS.sessionExpired,
    PATHS.changePassword,
    PATHS.ssoCallback,
    PATHS.unauthorized,
    PATHS.notFound,
    PATHS.serverError,
    PATHS.maintenance,
    PATHS.offline,
    PATHS.accountSuspended,
    PATHS.accountLocked,
    PATHS.accountDeactivated,
    PATHS.cookiesDisabled,
    ...Object.keys(PATH_ALIASES),
];

const RETURNABLE = [
    PATHS.about,
    PATHS.privacy,
    PATHS.terms,
    PATHS.getStarted,
    PATHS.comingSoon,
    PATHS.onboarding,
    PATHS.dashboard,
    PATHS.competencies,
    PATHS.gaps,
    PATHS.recommendations,
    PATHS.path,
    PATHS.courses,
    PATHS.courseDetail,
    PATHS.enrolments,
    PATHS.quizzes,
    PATHS.quizDetail,
    PATHS.attempt,
    PATHS.result,
    PATHS.practice,
    PATHS.chat,
    PATHS.labs,
    PATHS.notifications,
    "/settings/*",
    "/trainer/*",
    "/admin/*",
    PATHS.admin,
    "/superadmin/*",
];

/** True when the pathname is a real, non-auth route that may be returned to after sign-in (AUTH-57). */
export function isReturnablePath(pathname) {
    if (typeof pathname !== "string") return false;
    if (NON_RETURNABLE.includes(pathname)) return false;
    return RETURNABLE.some(
        (pattern) => matchPath({ path: pattern, end: true }, pathname) !== null
    );
}

/** True for auth entry and email-link pages (used to avoid redirect loops). */
export function isAuthPath(pathname) {
    return [
        PATHS.login,
        PATHS.signup,
        PATHS.forgotPassword,
        PATHS.resetPassword,
        PATHS.verifyEmail,
        PATHS.confirmEmailChange,
        PATHS.undoEmailChange,
        PATHS.acceptInvite,
        PATHS.sessionExpired,
    ].includes(pathname);
}

/** Fills `:param` segments, encoding each value. */
export function buildPath(pattern, params = {}) {
    return pattern.replace(/:([A-Za-z0-9_]+)/g, (_, name) => {
        const value = params[name];
        if (value === undefined || value === null || value === "")
            throw new Error(`Missing path parameter: ${name}`);
        return encodeURIComponent(String(value));
    });
}
