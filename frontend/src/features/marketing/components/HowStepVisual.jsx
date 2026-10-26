import { useTranslation } from "react-i18next";
import { CheckCircleIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
    MAX_LEVEL,
    MOCK_COMPETENCIES,
    MOCK_PATH,
    rankedGaps,
} from "@/features/marketing/data/heroMock";

function Bar({ label, value }) {
    return (
        <div className="flex flex-col gap-1.5">
            <span className="type-small text-card-foreground">{label}</span>
            <Progress value={(value / MAX_LEVEL) * 100} />
        </div>
    );
}

function ProfileVisual({ t }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("how.visual.estimate")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-3">
                    {["designation", "role", "experience"].map((field) => (
                        <div key={field} className="flex flex-col gap-2">
                            <span className="type-caption text-muted-foreground">
                                {t(`how.visual.${field}`)}
                            </span>
                            <span className="h-3 rounded-md bg-muted" />
                        </div>
                    ))}
                </div>
                {MOCK_COMPETENCIES.slice(0, 3).map((item) => (
                    <Bar
                        key={item.id}
                        label={t(`hero.mock.competencies.${item.id}`)}
                        value={item.current}
                    />
                ))}
            </CardContent>
        </Card>
    );
}

function GapsVisual({ t }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("hero.mock.gapsTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {rankedGaps().map((item) => (
                    <div key={item.id} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <span className="type-small text-card-foreground">
                                {t(`hero.mock.competencies.${item.id}`)}
                            </span>
                            <Badge variant="warning">
                                {t("hero.mock.columnGap")} {item.gap}
                            </Badge>
                        </div>
                        <Progress
                            value={(item.current / item.required) * 100}
                        />
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

function PathVisual({ t }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("hero.mock.pathTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
                <ol className="flex flex-col gap-4">
                    {MOCK_PATH.map((id, index) => (
                        <li key={id} className="flex items-start gap-3">
                            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent font-mono type-caption text-accent-foreground">
                                {index + 1}
                            </span>
                            <div className="flex flex-col gap-1">
                                <span className="type-small text-card-foreground">
                                    {t(`hero.mock.path.${id}`)}
                                </span>
                                <span className="type-caption text-muted-foreground">
                                    {t("how.visual.why")}
                                </span>
                            </div>
                            <Badge variant="secondary" className="ml-auto">
                                {t("hero.mock.simulated")}
                            </Badge>
                        </li>
                    ))}
                </ol>
            </CardContent>
        </Card>
    );
}

function EvidenceVisual({ t }) {
    const privacy = MOCK_COMPETENCIES.find((item) => item.id === "privacy");
    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("how.steps.evidence.title")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {["quiz", "completed", "updated"].map((row) => (
                    <div
                        key={row}
                        className="flex items-center gap-3 rounded-md border border-border p-3"
                    >
                        <CheckCircleIcon className="size-5 text-success" />
                        <span className="type-small text-card-foreground">
                            {t(`how.visual.${row}`)}
                        </span>
                    </div>
                ))}
                <Bar
                    label={t(`hero.mock.competencies.${privacy.id}`)}
                    value={privacy.current + 1}
                />
            </CardContent>
        </Card>
    );
}

const VISUALS = {
    profile: ProfileVisual,
    gaps: GapsVisual,
    path: PathVisual,
    evidence: EvidenceVisual,
};

/** Flat, decorative mock for one "How it works" step, built from shadcn components and fixture data. */
export function HowStepVisual({ id }) {
    const { t } = useTranslation("landing");
    const Visual = VISUALS[id];
    return Visual ? <Visual t={t} /> : null;
}
