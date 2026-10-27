import { redirect } from "react-router";
import { GuestRoute } from "@/app/guards/GuestRoute";
import { ProtectedRoute } from "@/app/guards/ProtectedRoute";
import { RoleRoute } from "@/app/guards/RoleRoute";
import { BootSplash } from "@/app/providers/BootSplash";
import { RootLayout } from "@/app/providers/RootLayout";
import { RouteErrorBoundary } from "@/app/providers/RouteErrorBoundary";
import { PATHS, PATH_ALIASES } from "@/lib/paths";
import { ROLE_SETS } from "@/lib/permissions";
import {
    lazyMarketingLayout,
    lazyAuthLayout,
    lazyAppShell,
    lazyLanding,
    lazyAbout,
    lazyPrivacy,
    lazyTerms,
    lazyGetStarted,
    lazyNotFound,
    lazyUnauthorized,
    lazyServerError,
    lazyMaintenance,
    lazyOffline,
    lazyCookiesDisabled,
    lazyComingSoon,
    lazyVerifyCertificate,
    lazyLogin,
    lazySignup,
    lazyForgotPassword,
    lazyResetPassword,
    lazyVerifyEmail,
    lazyVerifyEmailSent,
    lazyConfirmEmail,
    lazyUndoEmail,
    lazyAcceptInvite,
    lazySessionExpired,
    lazyChangePassword,
    lazySsoCallback,
    lazyAccountSuspended,
    lazyAccountLocked,
    lazyAccountDeactivated,
    lazyProfile,
    lazySecurity,
    lazySessions,
    lazyLabs,
    lazyDashboard,
    lazyOnboarding,
    lazyAdminInvites,
    lazyAdminUsers,
} from "@/app/lazyPages";

/*
 * Route table (FE-65..69). Route authority: docs/23 section 2 plus R3. Every page loads through the route `lazy`
 * property (FE-66); guards are static and the three frames are lazy too (see below). `handle.title` is an i18n key used for the document title.
 * Guards are layout routes: GuestRoute (login, signup), ProtectedRoute (signed in), RoleRoute (explicit roles).
 * Frames: MarketingLayout (public pages), AuthSplitLayout (sign-in, email-link and account pages), AppShell (signed-in app).
 */
const route = (path, lazy, title) => ({ path, lazy, handle: { title } });
/* A page whose document title is the `title` key of an `auth` section. */
const acct = (path, lazy, section) =>
    route(path, lazy, `auth:${section}.title`);

/* Not-yet-built sidebar destinations render the coming-soon page (doc 21 section 5). */
const soon = (path, title) => route(path, lazyComingSoon, title);

const aliasRoutes = Object.entries(PATH_ALIASES).map(([from, to]) => ({
    path: from,
    loader: () => redirect(to),
}));

/* Public marketing, legal, start and state pages: MarketingLayout (navbar, footer, main landmark). */
const marketingRoutes = [
    route(PATHS.home, lazyLanding, "common:pages.landing"),
    route(PATHS.about, lazyAbout, "common:pages.about"),
    route(PATHS.privacy, lazyPrivacy, "common:pages.privacy"),
    route(PATHS.terms, lazyTerms, "common:pages.terms"),
    route(PATHS.getStarted, lazyGetStarted, "common:pages.getStarted"),
    route(
        PATHS.verifyCertificate,
        lazyVerifyCertificate,
        "common:pages.verifyCertificate"
    ),
    route(PATHS.unauthorized, lazyUnauthorized, "errors:unauthorized.title"),
    route(PATHS.notFound, lazyNotFound, "errors:notFound.title"),
    route(PATHS.serverError, lazyServerError, "errors:serverError.title"),
    route(PATHS.maintenance, lazyMaintenance, "errors:maintenance.title"),
    route(PATHS.offline, lazyOffline, "errors:offline.title"),
    route(
        PATHS.cookiesDisabled,
        lazyCookiesDisabled,
        "errors:cookiesDisabled.title"
    ),
    route(PATHS.comingSoon, lazyComingSoon, "errors:comingSoon.title"),
    route("*", lazyNotFound, "errors:notFound.title"),
];

/* Email-link, session and account-state pages. No guard: they must open for anonymous and signed-in visitors. */
const accountRoutes = [
    route(PATHS.resetPassword, lazyResetPassword, "auth:reset.title"),
    route(PATHS.verifyEmail, lazyVerifyEmail, "auth:verifyEmail.title"),
    route(PATHS.verifyEmailSent, lazyVerifyEmailSent, "auth:verifySent.title"),
    acct(PATHS.confirmEmailChange, lazyConfirmEmail, "confirmEmailChange"),
    acct(PATHS.undoEmailChange, lazyUndoEmail, "undoEmailChange"),
    route(PATHS.acceptInvite, lazyAcceptInvite, "auth:acceptInvite.title"),
    route(PATHS.ssoCallback, lazySsoCallback, "auth:sso.title"),
    route(
        PATHS.sessionExpired,
        lazySessionExpired,
        "errors:sessionExpired.title"
    ),
    route(
        PATHS.accountSuspended,
        lazyAccountSuspended,
        "errors:accountSuspended.title"
    ),
    route(PATHS.accountLocked, lazyAccountLocked, "errors:accountLocked.title"),
    route(
        PATHS.accountDeactivated,
        lazyAccountDeactivated,
        "errors:accountDeactivated.title"
    ),
];

const learnerRoutes = [
    route(PATHS.dashboard, lazyDashboard, "common:pages.dashboard"),
    route(PATHS.labs, lazyLabs, "common:pages.labs"),
    soon(PATHS.competencies, "nav:sidebar.competencies"),
    soon(PATHS.gaps, "nav:sidebar.gaps"),
    soon(PATHS.recommendations, "nav:sidebar.recommendations"),
    soon(PATHS.path, "nav:sidebar.path"),
    soon(PATHS.courses, "nav:sidebar.path"),
    soon(PATHS.courseDetail, "nav:sidebar.path"),
    soon(PATHS.enrolments, "nav:sidebar.path"),
    soon(PATHS.quizzes, "nav:sidebar.quizzes"),
    soon(PATHS.quizDetail, "nav:sidebar.quizzes"),
    soon(PATHS.attempt, "nav:sidebar.quizzes"),
    soon(PATHS.result, "nav:sidebar.quizzes"),
    soon(PATHS.practice, "nav:sidebar.quizzes"),
    soon(PATHS.chat, "nav:sidebar.tutor"),
    soon(PATHS.notifications, "nav:sidebar.notifications"),
    acct(PATHS.settingsProfile, lazyProfile, "settings.profile"),
    acct(PATHS.settingsSecurity, lazySecurity, "settings.security"),
    acct(PATHS.settingsSessions, lazySessions, "settings.sessions"),
    soon(PATHS.settingsNotifications, "nav:sidebar.settings"),
    soon(PATHS.settingsLanguage, "nav:sidebar.settings"),
];

const trainerRoutes = [
    soon(PATHS.trainerContent, "nav:sidebar.content"),
    soon(PATHS.trainerContentDetail, "nav:sidebar.content"),
    soon(PATHS.trainerGenerate, "nav:sidebar.generate"),
    soon(PATHS.trainerQuestions, "nav:sidebar.review"),
    soon(PATHS.trainerQuizzes, "nav:sidebar.trainerQuizzes"),
    soon(PATHS.trainerQuizResults, "nav:sidebar.trainerQuizzes"),
];

const adminRoutes = [
    soon(PATHS.admin, "nav:sidebar.adminOverview"),
    soon(PATHS.adminAnalytics, "nav:sidebar.analytics"),
    route(PATHS.adminUsers, lazyAdminUsers, "nav:sidebar.users"),
    route(PATHS.adminInvites, lazyAdminInvites, "nav:sidebar.invites"),
    soon(PATHS.adminDepartments, "nav:sidebar.departments"),
    soon(PATHS.adminAudit, "nav:sidebar.audit"),
    soon(PATHS.adminIntegrations, "nav:sidebar.integrations"),
    soon(PATHS.adminSettings, "nav:sidebar.adminSettings"),
];

const superadminRoutes = [
    soon(PATHS.superadminOrganisations, "nav:sidebar.organisations"),
    soon(PATHS.superadminFramework, "nav:sidebar.framework"),
    soon(PATHS.superadminSystem, "nav:sidebar.system"),
];

/* Sign-in pages (guest only), password recovery and the forced password change. */
const guestRoutes = [
    {
        element: <GuestRoute />,
        children: [
            route(PATHS.login, lazyLogin, "auth:login.title"),
            route(PATHS.signup, lazySignup, "auth:signup.title"),
        ],
    },
    {
        element: <GuestRoute signedInTo={PATHS.settingsSecurity} />,
        children: [
            route(
                PATHS.forgotPassword,
                lazyForgotPassword,
                "auth:forgot.title"
            ),
        ],
    },
    {
        element: <ProtectedRoute allowMustChange />,
        children: [
            route(
                PATHS.changePassword,
                lazyChangePassword,
                "auth:mustChange.title"
            ),
        ],
    },
];

/* Signed-in app: AppShell around the role-guarded groups. Roles are explicit arrays (AUTH-60). */
const roleGroup = (roles, children) => ({
    element: <RoleRoute roles={roles} />,
    children,
});

const appRoutes = {
    lazy: lazyAppShell,
    children: [
        roleGroup(ROLE_SETS.learner, learnerRoutes),
        roleGroup(ROLE_SETS.trainer, trainerRoutes),
        roleGroup(ROLE_SETS.admin, adminRoutes),
        roleGroup(ROLE_SETS.superadmin, superadminRoutes),
    ],
};

export const routes = [
    {
        element: <RootLayout />,
        errorElement: <RouteErrorBoundary />,
        HydrateFallback: BootSplash,
        children: [
            {
                errorElement: <RouteErrorBoundary />,
                children: [
                    ...aliasRoutes,
                    { lazy: lazyMarketingLayout, children: marketingRoutes },
                    {
                        lazy: lazyAuthLayout,
                        children: [...accountRoutes, ...guestRoutes],
                    },
                    {
                        element: <ProtectedRoute allowOnboarding />,
                        children: [
                            route(
                                PATHS.onboarding,
                                lazyOnboarding,
                                "common:pages.onboarding"
                            ),
                        ],
                    },
                    { element: <ProtectedRoute />, children: [appRoutes] },
                ],
            },
        ],
    },
];
