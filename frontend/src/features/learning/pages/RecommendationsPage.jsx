import { useState, useEffect } from "react";
import { apiClient } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    CheckCircleIcon,
    ClockIcon,
    ExternalLinkIcon,
    FilterIcon,
    MagicIcon,
} from "@/components/icons";

export default function RecommendationsPage() {
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState("all");
    const [enrolledMap, setEnrolledMap] = useState({});

    useEffect(() => {
        setLoading(true);
        apiClient
            .get("/learning/me/recommendations?targetRole=statistical_officer")
            .then((res) => {
                const recs = res.data?.data?.recommendations || [];
                setRecommendations(recs);
                const map = {};
                for (const r of recs) {
                    if (r.isEnrolled) map[r.id] = true;
                }
                setEnrolledMap(map);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const handleEnroll = async (courseId) => {
        try {
            await apiClient.post("/learning/me/enrolments", { courseId });
            setEnrolledMap((prev) => ({ ...prev, [courseId]: true }));
        } catch {
            // fallback local update
            setEnrolledMap((prev) => ({ ...prev, [courseId]: true }));
        }
    };

    const filtered = activeFilter === "all"
        ? recommendations
        : activeFilter === "critical"
        ? recommendations.filter((r) => r.matchedGap?.severity === "critical")
        : recommendations.filter((r) => r.domain.toLowerCase() === activeFilter.toLowerCase());

    return (
        <main id="main-content" tabIndex={-1} className="flex flex-col gap-8 focus:outline-none p-2 sm:p-6">
            <header className="flex flex-col gap-2 border-b pb-6">
                <div className="flex items-center gap-2 text-primary font-medium text-sm">
                    <MagicIcon className="w-4 h-4" />
                    <span>AI-Powered Learning Recommender</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    Recommended Learning Pathways
                </h1>
                <p className="text-muted-foreground text-sm max-w-2xl">
                    Targeted certified courses curated from iGOT Karmayogi and NSSTA to bridge your detected competency deficits.
                </p>
            </header>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 border-b pb-3">
                <FilterIcon className="w-4 h-4 text-muted-foreground mr-1" />
                {[
                    { id: "all", label: "All Recommended" },
                    { id: "critical", label: "Critical Gap Closers" },
                    { id: "Statistical", label: "Statistical" },
                    { id: "Technical", label: "Technical" },
                    { id: "Digital Governance", label: "Governance" },
                ].map((tab) => (
                    <Button
                        key={tab.id}
                        variant={activeFilter === tab.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveFilter(tab.id)}
                        className="h-8 text-xs"
                    >
                        {tab.label}
                    </Button>
                ))}
            </div>

            {loading ? (
                <div className="text-center py-12 text-muted-foreground">Loading personalized recommendations...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No recommendations matching filter.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map((course) => {
                        const isEnrolled = enrolledMap[course.id];
                        const isCritical = course.matchedGap?.severity === "critical";

                        return (
                            <Card key={course.id} className="flex flex-col justify-between border hover:shadow-lg transition-all">
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <Badge variant="outline" className="text-[11px] font-medium bg-muted/50">
                                            {course.provider}
                                        </Badge>
                                        {isCritical && (
                                            <Badge variant="destructive" className="text-[11px]">
                                                High Impact
                                            </Badge>
                                        )}
                                    </div>
                                    <CardTitle className="text-base font-semibold leading-snug line-clamp-2">
                                        {course.title}
                                    </CardTitle>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                                        <span className="flex items-center gap-1">
                                            <ClockIcon className="w-3.5 h-3.5" />
                                            {course.durationHours} hrs
                                        </span>
                                        <span>&bull;</span>
                                        <span>Target: Level {course.targetLevel}</span>
                                        <span>&bull;</span>
                                        <span className="text-amber-500 font-semibold">{course.rating} &starf;</span>
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                                    {/* AI Justification Callout */}
                                    <div className="bg-primary/5 border border-primary/15 rounded-md p-2.5 text-xs text-primary-foreground font-medium flex gap-2">
                                        <MagicIcon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                        <p className="text-foreground/90">{course.aiReason}</p>
                                    </div>

                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                        {course.description}
                                    </p>

                                    <div className="pt-3 border-t flex items-center justify-between gap-3">
                                        <Button
                                            size="sm"
                                            variant={isEnrolled ? "secondary" : "default"}
                                            onClick={() => handleEnroll(course.id)}
                                            className="text-xs h-8 flex-1"
                                            disabled={isEnrolled}
                                        >
                                            {isEnrolled ? (
                                                <span className="flex items-center gap-1">
                                                    <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                                                    <span>Enrolled</span>
                                                </span>
                                            ) : (
                                                <span>Enroll Now</span>
                                            )}
                                        </Button>

                                        <a
                                            href={course.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex"
                                        >
                                            <Button variant="outline" size="sm" className="text-xs h-8 gap-1">
                                                <span>iGOT</span>
                                                <ExternalLinkIcon className="w-3.5 h-3.5" />
                                            </Button>
                                        </a>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </main>
    );
}
