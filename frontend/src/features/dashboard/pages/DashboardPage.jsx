import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { RadarIcon } from "@/components/icons";
import { RoleBadge } from "@/components/layout/RoleBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NextStepCard } from "@/features/dashboard/components/NextStepCard";
import { useAuth } from "@/features/auth";
import { getDisplayName, getNextSteps } from "@/lib/navigation";
import { PATHS } from "@/lib/paths";

const INTRO_KEYS = {
    learner: "dashboard.intro.learner",
    trainer: "dashboard.intro.trainer",
    admin: "dashboard.intro.admin",
    superadmin: "dashboard.intro.superadmin",
};

/**
 * Role-aware dashboard placeholder: a welcome with the person's name and role, the areas planned next for that
 * role, and an honest empty overview. It shows no figures because nothing real exists to measure yet.
 * Renders its own `<main>` landmark inside AppShell.
 */
export default function DashboardPage() {
    const { t } = useTranslation("nav");
    const { user } = useAuth();
    const name = getDisplayName(user);
    const steps = getNextSteps(user);

    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="flex flex-col gap-10 focus:outline-none"
        >
            <header className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="type-h1 text-foreground">
                        {name
                            ? t("dashboard.welcome", { name })
                            : t("dashboard.welcomeFallback")}
                    </h1>
                    <span className="sr-only">{t("dashboard.roleLabel")}</span>
                    <RoleBadge role={user?.role} />
                </div>
                <p className="type-body max-w-prose text-muted-foreground">
                    {t(INTRO_KEYS[user?.role] ?? INTRO_KEYS.learner)}
                </p>
            </header>

            {steps.length > 0 ? (
                <section
                    aria-labelledby="dashboard-next-steps"
                    className="flex flex-col gap-4"
                >
                    <div className="flex flex-col gap-1">
                        <h2
                            id="dashboard-next-steps"
                            className="type-h3 text-foreground"
                        >
                            {t("dashboard.nextSteps")}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {t("dashboard.nextStepsHint")}
                        </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {steps.map((entry) => (
                            <NextStepCard key={entry.id} entry={entry} />
                        ))}
                    </div>
                </section>
            ) : null}

            <section
                aria-labelledby="dashboard-overview"
                className="flex flex-col gap-4"
            >
                <h2 id="dashboard-overview" className="type-h3 text-foreground">
                    {t("dashboard.overview.title")}
                </h2>
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
                        <RadarIcon
                            className="size-6 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <p className="font-medium text-card-foreground">
                            {t("dashboard.overview.emptyTitle")}
                        </p>
                        <p className="max-w-prose text-muted-foreground">
                            {t("dashboard.overview.emptyBody")}
                        </p>
                        <Button asChild>
                            <Link to={PATHS.settingsProfile}>
                                {t("dashboard.overview.action")}
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </section>
        </main>
    );
}
