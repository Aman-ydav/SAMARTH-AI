import { PATHS } from "@/lib/paths";
import { ROLES, ROLE_SETS } from "@/lib/permissions";

const { LEARNER, TRAINER, ADMIN, SUPERADMIN } = ROLES;

/*
 * What the Help page covers, by audience. The audiences mirror the sidebar groups in `lib/navigation.js` (who sees which
 * area); hiding a section is UX only, the guards and the API still decide access (FE-55).
 * A topic with a `to` is built and gets an "Open" link; a topic without one is planned and shows a "Coming soon" badge.
 * Keys are literal strings in the `help` namespace (FE-83); when a screen is built, add its `to` here and nothing else.
 */
export const HELP_SECTIONS = Object.freeze([
    {
        id: "everyone",
        titleKey: "sections.everyone.title",
        descriptionKey: "sections.everyone.description",
        roles: ROLE_SETS.all,
        topics: [
            {
                titleKey: "topics.dashboard.title",
                bodyKey: "topics.dashboard.body",
                to: PATHS.dashboard,
            },
            {
                titleKey: "topics.notifications.title",
                bodyKey: "topics.notifications.body",
                to: PATHS.notifications,
            },
            {
                titleKey: "topics.profile.title",
                bodyKey: "topics.profile.body",
                to: PATHS.settingsProfile,
            },
            {
                titleKey: "topics.security.title",
                bodyKey: "topics.security.body",
                to: PATHS.settingsSecurity,
            },
            {
                titleKey: "topics.sessions.title",
                bodyKey: "topics.sessions.body",
                to: PATHS.settingsSessions,
            },
        ],
    },
    {
        id: "learner",
        titleKey: "sections.learner.title",
        descriptionKey: "sections.learner.description",
        roles: [LEARNER],
        topics: [
            {
                titleKey: "topics.gaps.title",
                bodyKey: "topics.gaps.body",
                to: PATHS.gaps,
            },
            {
                titleKey: "topics.recommendations.title",
                bodyKey: "topics.recommendations.body",
                to: PATHS.recommendations,
            },
            {
                titleKey: "topics.quizzes.title",
                bodyKey: "topics.quizzes.body",
            },
            {
                titleKey: "topics.tutor.title",
                bodyKey: "topics.tutor.body",
            },
            {
                titleKey: "topics.labs.title",
                bodyKey: "topics.labs.body",
            },
        ],
    },
    {
        id: "trainer",
        titleKey: "sections.trainer.title",
        descriptionKey: "sections.trainer.description",
        roles: [TRAINER],
        topics: [
            {
                titleKey: "topics.content.title",
                bodyKey: "topics.content.body",
            },
            {
                titleKey: "topics.generate.title",
                bodyKey: "topics.generate.body",
            },
            {
                titleKey: "topics.review.title",
                bodyKey: "topics.review.body",
            },
            {
                titleKey: "topics.trainerQuizzes.title",
                bodyKey: "topics.trainerQuizzes.body",
            },
        ],
    },
    {
        id: "admin",
        titleKey: "sections.admin.title",
        descriptionKey: "sections.admin.description",
        roles: [ADMIN, SUPERADMIN],
        topics: [
            {
                titleKey: "topics.users.title",
                bodyKey: "topics.users.body",
                to: PATHS.adminUsers,
            },
            {
                titleKey: "topics.invites.title",
                bodyKey: "topics.invites.body",
                to: PATHS.adminInvites,
            },
            {
                titleKey: "topics.audit.title",
                bodyKey: "topics.audit.body",
                to: PATHS.adminAudit,
            },
            {
                titleKey: "topics.overview.title",
                bodyKey: "topics.overview.body",
            },
            {
                titleKey: "topics.analytics.title",
                bodyKey: "topics.analytics.body",
            },
            {
                titleKey: "topics.departments.title",
                bodyKey: "topics.departments.body",
            },
        ],
    },
    {
        id: "superadmin",
        titleKey: "sections.superadmin.title",
        descriptionKey: "sections.superadmin.description",
        roles: [SUPERADMIN],
        topics: [
            {
                titleKey: "topics.organisations.title",
                bodyKey: "topics.organisations.body",
                to: PATHS.superadminOrganisations,
            },
            {
                titleKey: "topics.framework.title",
                bodyKey: "topics.framework.body",
            },
            {
                titleKey: "topics.system.title",
                bodyKey: "topics.system.body",
            },
        ],
    },
]);
