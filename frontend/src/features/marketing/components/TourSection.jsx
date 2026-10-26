import { useTranslation } from "react-i18next";
import { CheckIcon, InfoIcon } from "@/components/icons";
import { CloudinaryImage } from "@/components/media/CloudinaryImage";
import { ScrollMedia } from "@/components/motion/ScrollMedia";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TOUR_PANELS } from "@/features/marketing/data/landingContent";

function TourPanel({ panel, t }) {
    const key = `tour.panels.${panel.id}`;
    const bullets = t(`${key}.bullets`, { returnObjects: true });
    const note = t(`${key}.note`);

    return (
        <article className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
            <div className="flex flex-col gap-4">
                <h3 className="type-h2 text-foreground">
                    {t(`${key}.headline`)}
                </h3>
                <p className="type-body-lg text-muted-foreground">
                    {t(`${key}.sub`)}
                </p>
                <ul className="flex flex-col gap-2">
                    {(Array.isArray(bullets) ? bullets : []).map((bullet) => (
                        <li
                            key={bullet}
                            className="flex items-start gap-2 type-body"
                        >
                            <CheckIcon
                                aria-hidden="true"
                                className="mt-1 size-4 shrink-0 text-primary-text"
                            />
                            <span>{bullet}</span>
                        </li>
                    ))}
                </ul>
                {panel.alwaysBanner ? (
                    <Alert variant="info" role="note">
                        <InfoIcon aria-hidden="true" />
                        <AlertDescription>{note}</AlertDescription>
                    </Alert>
                ) : note ? (
                    <p className="type-small text-muted-foreground">{note}</p>
                ) : null}
            </div>
            <figure className="flex flex-col gap-3">
                <CloudinaryImage
                    slot={panel.slot}
                    sizes="(min-width: 768px) 50vw, 100vw"
                />
                <figcaption>
                    <Badge variant="secondary">{t("media.demoData")}</Badge>
                </figcaption>
            </figure>
        </article>
    );
}

/** Product tour (SCROLL_MEDIA): five feature panels crossfade inside one pinned stage, each with its screenshot slot. */
export function TourSection() {
    const { t } = useTranslation("landing");
    const frames = TOUR_PANELS.map((panel) => ({
        id: panel.id,
        content: <TourPanel panel={panel} t={t} />,
    }));

    return (
        <section aria-labelledby="tour-title" className="py-12 md:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <h2
                    id="tour-title"
                    className="type-h1 max-w-3xl text-foreground"
                >
                    {t("tour.title")}
                </h2>
                <p className="mt-4 max-w-2xl type-body-lg text-muted-foreground">
                    {t("tour.sub")}
                </p>
                <ScrollMedia className="mt-10" frames={frames} />
            </div>
        </section>
    );
}
