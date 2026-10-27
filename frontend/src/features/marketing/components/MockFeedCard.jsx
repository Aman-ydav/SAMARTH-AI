import { CheckCircleIcon, HistoryIcon, QuizIcon } from "@/components/icons";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_FEED } from "@/features/marketing/data/heroMock";
import { cn } from "@/lib/utils";

function FeedRow({ icon: Icon, text, when, className }) {
    return (
        <div className={cn("flex items-start gap-2", className)}>
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                <Icon aria-hidden="true" className="size-3.5" />
            </span>
            <div className="min-w-0">
                <p className="type-small text-card-foreground">{text}</p>
                <p className="type-caption text-muted-foreground">{when}</p>
            </div>
        </div>
    );
}

/** Recent activity feed. The first slot holds two rows on top of each other and swaps them by opacity at the evidence step. */
export function MockFeedCard({ t, view }) {
    const swap =
        "transition-opacity duration-500 motion-reduce:transition-none";
    return (
        <Card className="h-72 gap-2 overflow-clip [--card-spacing:--spacing(3)]">
            <CardHeader>
                <CardTitle>{t("hero.mock.feed.title")}</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-3 px-3">
                <div className="grid">
                    <FeedRow
                        icon={HistoryIcon}
                        text={t("hero.mock.feed.items.pathReady")}
                        when={t("hero.mock.feed.when.now")}
                        className={cn(
                            "col-start-1 row-start-1",
                            swap,
                            view.evidence ? "opacity-0" : "opacity-100"
                        )}
                    />
                    <FeedRow
                        icon={QuizIcon}
                        text={t("hero.mock.feed.items.quizPassed")}
                        when={t("hero.mock.feed.when.now")}
                        className={cn(
                            "col-start-1 row-start-1",
                            swap,
                            view.evidence ? "opacity-100" : "opacity-0"
                        )}
                    />
                </div>
                {MOCK_FEED.map((item) => (
                    <FeedRow
                        key={item.id}
                        icon={
                            item.id === "endorsed"
                                ? CheckCircleIcon
                                : HistoryIcon
                        }
                        text={t(`hero.mock.feed.items.${item.id}`)}
                        when={t(`hero.mock.feed.when.${item.when}`)}
                    />
                ))}
            </div>
        </Card>
    );
}
