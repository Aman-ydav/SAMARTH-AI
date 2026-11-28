import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

const SEVERITY_VARIANT = {
    critical: "destructive",
    high: "destructive",
    moderate: "warning",
    medium: "warning",
    low: "info",
    met: "success",
};

/** Top skill gaps with a text severity badge each (colour is never the only signal). */
export function SkillGapsCard({ gaps }) {
    const { t } = useTranslation("nav");
    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("dashboard.gaps.title")}</CardTitle>
                <CardDescription>{t("dashboard.gaps.hint")}</CardDescription>
            </CardHeader>
            <CardContent>
                {gaps.length === 0 ? (
                    <p className="text-muted-foreground">
                        {t("dashboard.gaps.none")}
                    </p>
                ) : (
                    <ol className="flex flex-col gap-4">
                        {gaps.map((gap) => (
                            <li
                                key={gap.competencyId}
                                className="flex items-start justify-between gap-3"
                            >
                                <div className="flex flex-col">
                                    <span className="font-medium text-foreground">
                                        {gap.name}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                        {t("dashboard.gaps.levels", {
                                            current: gap.currentLevel,
                                            required: gap.requiredLevel,
                                        })}
                                    </span>
                                </div>
                                <Badge
                                    variant={
                                        SEVERITY_VARIANT[gap.severity] ??
                                        "default"
                                    }
                                >
                                    {t(`dashboard.severity.${gap.severity}`, {
                                        defaultValue: gap.severity,
                                    })}
                                </Badge>
                            </li>
                        ))}
                    </ol>
                )}
            </CardContent>
        </Card>
    );
}
