import { useTranslation } from "react-i18next";
import { CheckIcon } from "@/components/icons";
import { CloudinaryImage } from "@/components/media/CloudinaryImage";
import { HorizontalScrollGallery } from "@/components/motion/HorizontalScrollGallery";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
} from "@/components/ui/card";
import { ROLE_CARDS } from "@/features/marketing/data/landingContent";

function RoleCard({ role, t }) {
    const key = `roles.items.${role.id}`;
    const bullets = t(`${key}.bullets`, { returnObjects: true });
    return (
        <Card className="h-full">
            <CardHeader>
                <h3 className="type-h3 text-card-foreground">
                    {t(`${key}.title`)}
                </h3>
                <CardDescription className="type-body">
                    {t(`${key}.sub`)}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <ul className="flex flex-col gap-2">
                    {(Array.isArray(bullets) ? bullets : []).map((bullet) => (
                        <li
                            key={bullet}
                            className="flex items-start gap-2 type-small"
                        >
                            <CheckIcon
                                aria-hidden="true"
                                className="mt-0.5 size-4 shrink-0 text-primary-text"
                            />
                            <span>{bullet}</span>
                        </li>
                    ))}
                </ul>
                <CloudinaryImage slot={role.slot} optional sizes="20rem" />
            </CardContent>
        </Card>
    );
}

/** Role views (HORIZONTAL_GALLERY): learner, trainer, admin and platform admin cards on a sideways strip. */
export function RolesSection() {
    const { t } = useTranslation("landing");

    return (
        <section aria-labelledby="roles-title">
            <HorizontalScrollGallery
                items={ROLE_CARDS}
                label={t("roles.label")}
                renderItem={(role) => <RoleCard role={role} t={t} />}
                header={
                    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
                        <h2
                            id="roles-title"
                            className="type-h1 max-w-3xl text-foreground"
                        >
                            {t("roles.title")}
                        </h2>
                    </div>
                }
            />
        </section>
    );
}
