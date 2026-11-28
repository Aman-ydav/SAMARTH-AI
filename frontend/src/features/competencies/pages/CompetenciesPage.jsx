import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { LoadErrorAlert } from "@/components/common/LoadErrorAlert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompetencyCard } from "@/features/competencies/components/CompetencyCard";
import {
    domainsOf,
    fetchCompetencyProfile,
    selectCompetencyProfile,
} from "@/features/competencies/slice/competencyProfileSlice";
import { STATUS } from "@/lib/asyncState";

const ALL = "all";

/** The learner's own competency profile with a domain filter. Renders its own `<main>` inside AppShell. */
export default function CompetenciesPage() {
    const { t } = useTranslation("common");
    const dispatch = useAppDispatch();
    const { status, error, items } = useAppSelector(selectCompetencyProfile);
    const [domain, setDomain] = useState(ALL);
    const domains = useMemo(() => domainsOf(items), [items]);
    const visible = useMemo(
        () =>
            domain === ALL
                ? items
                : items.filter((item) => item.domain === domain),
        [items, domain]
    );
    const loading = status === STATUS.IDLE || status === STATUS.LOADING;

    useEffect(() => {
        dispatch(fetchCompetencyProfile());
    }, [dispatch]);

    let body;
    if (loading && items.length === 0) {
        body = (
            <div
                className="grid gap-4 md:grid-cols-2"
                aria-busy="true"
                aria-label={t("loading")}
            >
                {[0, 1, 2, 3].map((key) => (
                    <Skeleton key={key} className="h-48 w-full" />
                ))}
            </div>
        );
    } else if (status === STATUS.FAILED) {
        body = (
            <LoadErrorAlert
                error={error}
                onRetry={() => dispatch(fetchCompetencyProfile({ force: true }))}
            />
        );
    } else if (items.length === 0) {
        body = (
            <p className="text-muted-foreground">
                {t("competencies.empty")}
            </p>
        );
    } else {
        body = (
            <div className="grid gap-4 md:grid-cols-2">
                {visible.map((competency) => (
                    <CompetencyCard
                        key={competency.competencyId}
                        competency={competency}
                    />
                ))}
            </div>
        );
    }

    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="flex flex-col gap-6 focus:outline-none"
        >
            <header className="flex flex-col gap-2">
                <h1 className="type-h1 text-foreground">
                    {t("competencies.title")}
                </h1>
                <p className="max-w-prose text-muted-foreground">
                    {t("competencies.intro")}
                </p>
            </header>
            {items.length > 0 && (
                <Tabs value={domain} onValueChange={setDomain}>
                    <TabsList
                        aria-label={t("competencies.filter")}
                        className="h-auto flex-wrap"
                    >
                        <TabsTrigger value={ALL}>
                            {t("competencies.allDomains")}
                        </TabsTrigger>
                        {domains.map((name) => (
                            <TabsTrigger key={name} value={name}>
                                {name}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            )}
            {body}
        </main>
    );
}
