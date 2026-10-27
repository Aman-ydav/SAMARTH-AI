import { useTranslation } from "react-i18next";
import { getMediaSlot } from "@/assets/mediaManifest";
import { GithubIcon, LinkedinIcon } from "@/components/icons";
import { ExternalLink } from "@/components/common/ExternalLink";
import { CloudinaryImage } from "@/components/media/CloudinaryImage";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    getInitials,
    localizedText,
} from "@/features/marketing/data/developers";
import { resolveLanguage } from "@/lib/format";
import { safeExternalUrl } from "@/lib/safeUrl";

/** The portrait when the manifest slot has a real asset, otherwise initials (MEDIA-31: never a stand-in photo). */
function DeveloperAvatar({ developer, name, t }) {
    const slot = getMediaSlot(developer.slot);
    if (slot && !slot.placeholder && slot.publicId) {
        return (
            <CloudinaryImage
                slot={developer.slot}
                alt={t("developers.portraitAlt", { name })}
                sizes="64px"
                className="size-16 shrink-0 rounded-full"
            />
        );
    }
    return (
        <Avatar aria-hidden="true" className="size-16 shrink-0">
            <AvatarFallback className="type-h4 font-sans">
                {getInitials(name)}
            </AvatarFallback>
        </Avatar>
    );
}

function ProfileLinks({ developer, name, t }) {
    const links = [
        {
            id: "github",
            href: safeExternalUrl(developer.github),
            Icon: GithubIcon,
            visible: t("developers.githubName"),
            full: t("developers.github", { name }),
        },
        {
            id: "linkedin",
            href: safeExternalUrl(developer.linkedin),
            Icon: LinkedinIcon,
            visible: t("developers.linkedinName"),
            full: t("developers.linkedin", { name }),
        },
    ].filter((link) => link.href);
    if (links.length === 0) return null;
    return (
        <ul
            aria-label={t("developers.linksLabel", { name })}
            className="flex flex-wrap gap-x-4 gap-y-2"
        >
            {links.map(({ id, href, Icon, visible, full }) => (
                <li key={id}>
                    <ExternalLink
                        href={href}
                        className="type-small min-h-6 text-foreground"
                    >
                        <Icon aria-hidden="true" className="size-4" />
                        <span aria-hidden="true">{visible}</span>
                        <span className="sr-only">{full}</span>
                    </ExternalLink>
                </li>
            ))}
        </ul>
    );
}

/**
 * One developer card. All text comes from `data/developers.js`; a card marked `placeholder` carries the visible
 * "Placeholder" badge and `data-developer-placeholder`. Profile links render only when the value is a valid https URL.
 */
export function DeveloperCard({ developer }) {
    const { t, i18n } = useTranslation("about");
    const language = resolveLanguage(i18n.language);
    const name = developer.name;
    const role = localizedText(developer.role, language);
    const note = localizedText(developer.note, language);

    return (
        <Card
            className="h-full"
            data-developer={developer.id}
            data-developer-placeholder={
                developer.placeholder ? "true" : undefined
            }
        >
            <CardContent className="flex flex-col gap-4">
                <div className="flex items-start gap-4">
                    <DeveloperAvatar developer={developer} name={name} t={t} />
                    <div className="flex min-w-0 flex-col gap-1">
                        {developer.placeholder ? (
                            <Badge variant="warning" className="mb-1 w-fit">
                                {t("developers.placeholderBadge")}
                            </Badge>
                        ) : null}
                        <h3 className="type-h4 wrap-break-word">{name}</h3>
                        {role ? (
                            <p className="type-small font-medium text-primary-text">
                                <span className="sr-only">
                                    {t("developers.roleLabel")}:{" "}
                                </span>
                                {role}
                            </p>
                        ) : null}
                    </div>
                </div>
                {note ? (
                    <p className="type-small text-muted-foreground">{note}</p>
                ) : null}
                <ProfileLinks developer={developer} name={name} t={t} />
            </CardContent>
        </Card>
    );
}
