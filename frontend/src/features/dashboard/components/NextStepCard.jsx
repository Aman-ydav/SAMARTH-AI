import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import * as Icons from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardDescription,
    CardFooter,
    CardHeader,
} from "@/components/ui/card";

/** One suggested next area for the signed-in role. Planned areas say so with a text badge and an icon (UI-07). */
export function NextStepCard({ entry }) {
    const { t } = useTranslation("nav");
    const Icon = Icons[entry.icon];
    const label = t(entry.labelKey);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between gap-2">
                    <span className="flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                        {Icon ? (
                            <Icon className="size-5" aria-hidden="true" />
                        ) : null}
                    </span>
                    {entry.planned ? (
                        <Badge variant="info">
                            <Icons.TimerIcon aria-hidden="true" />
                            {t("dashboard.planned")}
                        </Badge>
                    ) : null}
                </div>
                <h3 className="type-h4 mt-2 text-card-foreground">{label}</h3>
                <CardDescription>{t(entry.descriptionKey)}</CardDescription>
            </CardHeader>
            <CardFooter>
                <Button asChild variant="outline" size="sm">
                    <Link
                        to={entry.to}
                        aria-label={t("dashboard.openNamed", { name: label })}
                    >
                        {t("dashboard.open")}
                        <Icons.ArrowRightIcon aria-hidden="true" />
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}
