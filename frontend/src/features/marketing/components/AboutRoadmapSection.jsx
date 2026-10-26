import { useId } from "react";
import { useTranslation } from "react-i18next";
import { HorizontalScrollGallery } from "@/components/motion/HorizontalScrollGallery";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROADMAP_PHASES } from "@/features/marketing/data/aboutContent";

const STATUS_VARIANT = {
    done: "success",
    inProgress: "info",
    planned: "outline",
};

/**
 * Project timeline from doc 13 (ANIM-51, fifth; HORIZONTAL_GALLERY per the placement matrix). Status badges
 * (done, in progress, planned) are set by the team in data/aboutContent.js. Lite and reduced tiers get the native
 * snap strip from the gallery component.
 */
export function AboutRoadmapSection() {
    const { t } = useTranslation("about");
    const titleId = useId();
    const phases = t("roadmap.phases", { returnObjects: true });
    const statusLabel = {
        done: t("roadmap.status.done"),
        inProgress: t("roadmap.status.inProgress"),
        planned: t("roadmap.status.planned"),
    };
    const items = ROADMAP_PHASES.flatMap(({ id, status }, index) => {
        const phase = Array.isArray(phases) ? phases[index] : null;
        return phase ? [{ id, status, ...phase }] : [];
    });

    return (
        <section aria-labelledby={titleId} className="py-12 md:py-20">
            <HorizontalScrollGallery
                items={items}
                label={t("roadmap.stripLabel")}
                header={
                    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
                        <h2 id={titleId} className="type-h2 text-balance">
                            {t("roadmap.title")}
                        </h2>
                        <p className="type-body-lg mt-3 max-w-prose text-muted-foreground">
                            {t("roadmap.intro")}
                        </p>
                    </div>
                }
                renderItem={(item) => (
                    <Card className="h-full">
                        <CardHeader>
                            <div className="flex items-center justify-between gap-2">
                                <span className="type-small font-mono text-muted-foreground">
                                    {item.period}
                                </span>
                                <Badge variant={STATUS_VARIANT[item.status]}>
                                    <span className="sr-only">
                                        {t("roadmap.statusLabel")}:{" "}
                                    </span>
                                    {statusLabel[item.status]}
                                </Badge>
                            </div>
                            <CardTitle>
                                <h3 className="type-h3">{item.title}</h3>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="type-body text-muted-foreground">
                                {item.body}
                            </p>
                        </CardContent>
                    </Card>
                )}
            />
        </section>
    );
}
