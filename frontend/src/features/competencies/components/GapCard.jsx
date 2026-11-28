import { Link } from "react-router";
import { ArrowUpRightIcon, AwardIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** One competency gap: severity badge, current against required level, and the two follow-up links. */
export function GapCard({ item }) {
    const isCritical = item.severity === "critical";
    const isModerate = item.severity === "moderate";

    return (
        <Card
            className={`relative transition-shadow hover:shadow-md ${
                isCritical
                    ? "border-destructive/40"
                    : isModerate
                      ? "border-warning-border"
                      : "border-border"
            }`}
        >
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className="text-xs font-mono">
                        {item.competencyId} &bull; {item.domain}
                    </Badge>
                    <Badge
                        variant={
                            isCritical
                                ? "destructive"
                                : isModerate
                                  ? "warning"
                                  : "secondary"
                        }
                        className="text-xs"
                    >
                        {isCritical
                            ? "Critical Gap"
                            : isModerate
                              ? "Moderate Gap"
                              : "Target Met"}
                    </Badge>
                </div>
                <CardTitle className="text-base font-semibold mt-2">
                    {item.name}
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                        <span className="text-muted-foreground">
                            Current: Level {item.currentLevel} / 5
                        </span>
                        <span className="text-foreground">
                            Required: Level {item.requiredLevel} / 5
                        </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1 h-2">
                        {[1, 2, 3, 4, 5].map((lvl) => {
                            const isAttained = lvl <= item.currentLevel;
                            const isNeeded = lvl <= item.requiredLevel;
                            return (
                                <div
                                    key={lvl}
                                    className={`rounded-sm h-full ${
                                        isAttained
                                            ? "bg-primary"
                                            : isNeeded
                                              ? "bg-warning-subtle border border-dashed border-warning-border"
                                              : "bg-muted"
                                    }`}
                                />
                            );
                        })}
                    </div>
                </div>

                <div className="pt-2 border-t flex items-center justify-between gap-2">
                    <Link
                        to={`/quizzes?competency=${item.competencyId}`}
                        className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
                    >
                        <AwardIcon className="w-3.5 h-3.5" />
                        <span>Diagnostic Quiz</span>
                    </Link>
                    <Link
                        to={`/recommendations?competency=${item.competencyId}`}
                        className="text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-1"
                    >
                        <span>Close Gap</span>
                        <ArrowUpRightIcon className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}
