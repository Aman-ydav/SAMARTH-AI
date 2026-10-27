/*
 * Lazy import factories for every page and route frame (FE-65, FE-66). `app/routes.jsx` holds the route table only; adding a
 * page means one factory here and one `route(...)` line there. Only this file and routes.jsx may import the page files of a feature (FS-43).
 */
const toRoute = (module) => ({ Component: module.default });
const toLayout = (name) => (module) => ({ Component: module[name] });

/* Frames are lazy route modules too: they carry Lenis, motion and the whole sidebar kit, which must stay out of the initial bundle (FE-111, ANIM-78). */
export const lazyMarketingLayout = () =>
    import("@/components/layout/MarketingLayout.jsx").then(
        toLayout("MarketingLayout")
    );
export const lazyAuthLayout = () =>
    import("@/components/layout/AuthSplitLayout.jsx").then(
        toLayout("AuthSplitLayout")
    );
export const lazyAppShell = () =>
    import("@/components/layout/AppShell.jsx").then(toLayout("AppShell"));

export const lazyLanding = () =>
    import("@/features/marketing/pages/LandingPage.jsx").then(toRoute);
export const lazyAbout = () =>
    import("@/features/marketing/pages/AboutPage.jsx").then(toRoute);
export const lazyPrivacy = () =>
    import("@/features/marketing/pages/PrivacyPage.jsx").then(toRoute);
export const lazyTerms = () =>
    import("@/features/marketing/pages/TermsPage.jsx").then(toRoute);
export const lazyGetStarted = () =>
    import("@/features/marketing/pages/GetStartedPage.jsx").then(toRoute);
export const lazyNotFound = () =>
    import("@/features/marketing/pages/NotFoundPage.jsx").then(toRoute);
export const lazyUnauthorized = () =>
    import("@/features/marketing/pages/UnauthorizedPage.jsx").then(toRoute);
export const lazyServerError = () =>
    import("@/features/marketing/pages/ServerErrorPage.jsx").then(toRoute);
export const lazyMaintenance = () =>
    import("@/features/marketing/pages/MaintenancePage.jsx").then(toRoute);
export const lazyOffline = () =>
    import("@/features/marketing/pages/OfflinePage.jsx").then(toRoute);
export const lazyCookiesDisabled = () =>
    import("@/features/marketing/pages/CookiesDisabledPage.jsx").then(toRoute);
export const lazyComingSoon = () =>
    import("@/features/marketing/pages/ComingSoonPage.jsx").then(toRoute);
export const lazyVerifyCertificate = () =>
    import("@/features/marketing/pages/VerifyCertificatePage.jsx").then(
        toRoute
    );
export const lazyLogin = () =>
    import("@/features/auth/pages/LoginPage.jsx").then(toRoute);
export const lazySignup = () =>
    import("@/features/auth/pages/SignupPage.jsx").then(toRoute);
export const lazyForgotPassword = () =>
    import("@/features/auth/pages/ForgotPasswordPage.jsx").then(toRoute);
export const lazyResetPassword = () =>
    import("@/features/auth/pages/ResetPasswordPage.jsx").then(toRoute);
export const lazyVerifyEmail = () =>
    import("@/features/auth/pages/VerifyEmailPage.jsx").then(toRoute);
export const lazyVerifyEmailSent = () =>
    import("@/features/auth/pages/VerifyEmailSentPage.jsx").then(toRoute);
export const lazyConfirmEmail = () =>
    import("@/features/auth/pages/ConfirmEmailChangePage.jsx").then(toRoute);
export const lazyUndoEmail = () =>
    import("@/features/auth/pages/UndoEmailChangePage.jsx").then(toRoute);
export const lazyAcceptInvite = () =>
    import("@/features/auth/pages/AcceptInvitePage.jsx").then(toRoute);
export const lazySessionExpired = () =>
    import("@/features/auth/pages/SessionExpiredPage.jsx").then(toRoute);
export const lazyChangePassword = () =>
    import("@/features/auth/pages/ChangePasswordPage.jsx").then(toRoute);
export const lazySsoCallback = () =>
    import("@/features/auth/pages/SsoCallbackPage.jsx").then(toRoute);
export const lazyAccountSuspended = () =>
    import("@/features/auth/pages/AccountSuspendedPage.jsx").then(toRoute);
export const lazyAccountLocked = () =>
    import("@/features/auth/pages/AccountLockedPage.jsx").then(toRoute);
export const lazyAccountDeactivated = () =>
    import("@/features/auth/pages/AccountDeactivatedPage.jsx").then(toRoute);
export const lazyProfile = () =>
    import("@/features/auth/pages/SettingsProfilePage.jsx").then(toRoute);
export const lazySecurity = () =>
    import("@/features/auth/pages/SettingsSecurityPage.jsx").then(toRoute);
export const lazySessions = () =>
    import("@/features/auth/pages/SettingsSessionsPage.jsx").then(toRoute);
export const lazyLabs = () =>
    import("@/features/labs/pages/LabsPage.jsx").then(toRoute);
export const lazyDashboard = () =>
    import("@/features/dashboard/pages/DashboardPage.jsx").then(toRoute);
export const lazyOnboarding = () =>
    import("@/features/onboarding/pages/OnboardingPage.jsx").then(toRoute);

export const lazyAdminInvites = () =>
    import("@/features/admin/pages/AdminInvitesPage.jsx").then(toRoute);
export const lazyAdminUsers = () =>
    import("@/features/admin/pages/AdminUsersPage.jsx").then(toRoute);
