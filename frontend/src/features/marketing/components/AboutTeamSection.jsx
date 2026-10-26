import { useTranslation } from "react-i18next";
import { Reveal } from "@/components/motion/Reveal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AboutSectionShell } from "@/features/marketing/components/AboutSectionShell";
import {
    ABOUT_PLACEHOLDERS,
    TEAM_SLOTS,
} from "@/features/marketing/data/aboutContent";

const STAGGER_SECONDS = 0.06;

/**
 * Six team slots (ANIM-51, seventh). Names, photos and bios are NOT real: every slot is badged "Placeholder"
 * and carries `data-team-slot="placeholder"` until the team supplies the details (docs/23 section 8, item 2).
 */
export function AboutTeamSection() {
    const { t } = useTranslation("about");
    const slots = t("team.slots", { returnObjects: true });

    return (
        <AboutSectionShell title={t("team.title")} intro={t("team.intro")}>
            <p className="type-small mb-6 text-muted-foreground">
                {t("team.placeholderNote")}
            </p>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {TEAM_SLOTS.map(({ id, initials }, index) => (
                    <Reveal as="li" key={id} delay={index * STAGGER_SECONDS}>
                        <Card className="h-full" data-team-slot="placeholder">
                            <CardContent className="flex-row items-start gap-4">
                                <Avatar size="lg">
                                    <AvatarFallback>{initials}</AvatarFallback>
                                </Avatar>
                                <div className="flex min-w-0 flex-col gap-1">
                                    <Badge variant="warning" className="mb-1">
                                        {t("team.placeholderBadge")}
                                    </Badge>
                                    <h3 className="type-h4">
                                        {t("team.namePlaceholder")}
                                    </h3>
                                    <p className="type-small font-medium text-primary-text">
                                        {Array.isArray(slots)
                                            ? slots[index]?.role
                                            : null}
                                    </p>
                                    <p className="type-small text-muted-foreground">
                                        {t("team.bioPlaceholder")}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </Reveal>
                ))}
            </ul>
            <p className="type-small mt-6 text-muted-foreground">
                {t("team.mentor", { mentor: ABOUT_PLACEHOLDERS.mentor })}
            </p>
        </AboutSectionShell>
    );
}
