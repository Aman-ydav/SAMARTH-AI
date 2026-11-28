import { useId } from "react";
import { useTranslation } from "react-i18next";
import { HelpTopicCard } from "@/features/help/components/HelpTopicCard";

/** One audience block of the Help page: a heading, a one-line description and the topic cards. */
export function HelpSection({ section }) {
    const { t } = useTranslation("help");
    const headingId = useId();

    return (
        <section aria-labelledby={headingId} className="flex flex-col gap-4">
            <header className="flex flex-col gap-1">
                <h2 id={headingId} className="type-h2 text-foreground">
                    {t(section.titleKey)}
                </h2>
                <p className="type-body max-w-prose text-muted-foreground">
                    {t(section.descriptionKey)}
                </p>
            </header>
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {section.topics.map((topic) => (
                    <li key={topic.titleKey}>
                        <HelpTopicCard topic={topic} />
                    </li>
                ))}
            </ul>
        </section>
    );
}
