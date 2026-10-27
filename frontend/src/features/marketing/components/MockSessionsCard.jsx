import { CalendarIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_SESSIONS } from "@/features/marketing/data/heroMock";

/** Upcoming sessions card: three simulated sessions with time, mode and source. */
export function MockSessionsCard({ t }) {
    return (
        <Card className="h-72 gap-2 overflow-clip [--card-spacing:--spacing(3)]">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{t("hero.mock.sessions.title")}</CardTitle>
                <CalendarIcon
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                />
            </CardHeader>
            <ul className="flex flex-col gap-3 px-3">
                {MOCK_SESSIONS.map((item) => (
                    <li
                        key={item.id}
                        className="flex flex-col gap-1 rounded-md border border-border p-2"
                    >
                        <span className="type-small text-card-foreground">
                            {t(`hero.mock.sessions.items.${item.id}`)}
                        </span>
                        <span className="font-mono type-caption text-muted-foreground">
                            {t(`hero.mock.sessions.when.${item.when}`)}
                        </span>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline">
                                {t(`hero.mock.sessions.mode.${item.mode}`)}
                            </Badge>
                            <Badge variant="secondary">
                                {t(`hero.mock.sources.${item.source}`)}
                            </Badge>
                        </div>
                    </li>
                ))}
            </ul>
        </Card>
    );
}
