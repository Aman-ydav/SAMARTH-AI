import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ArrowRightIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

/**
 * One help topic. A topic with a destination shows an "Available" badge and an Open link; a planned one shows
 * "Coming soon" and no link, so nobody is sent to a page that only says "planned". The badge carries the state as text (UI-07).
 */
export function HelpTopicCard({ topic }) {
    const { t } = useTranslation("help");
    const title = t(topic.titleKey);

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="type-h3">{title}</h3>
                    <Badge variant={topic.to ? "success" : "secondary"}>
                        {topic.to ? t("status.available") : t("status.soon")}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="type-body text-muted-foreground">
                {t(topic.bodyKey)}
            </CardContent>
            {topic.to ? (
                <CardFooter>
                    <Button asChild variant="outline" size="sm">
                        <Link
                            to={topic.to}
                            aria-label={t("actions.openTopic", {
                                topic: title,
                            })}
                        >
                            {t("actions.open")}
                            <ArrowRightIcon aria-hidden="true" />
                        </Link>
                    </Button>
                </CardFooter>
            ) : null}
        </Card>
    );
}
