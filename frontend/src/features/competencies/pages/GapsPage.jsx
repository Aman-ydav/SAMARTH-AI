import { useState, useEffect } from "react";
import { Link } from "react-router";
import { getMyGaps, getRoles } from "../api/competenciesApi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    ArrowUpRightIcon,
    AwardIcon,
    BookIcon,
    CheckCircleIcon,
    FilterIcon,
    MagicIcon,
    WarningIcon,
} from "@/components/icons";

export default function GapsPage() {
    const [roles, setRoles] = useState([]);
    const [selectedRole, setSelectedRole] = useState("statistical_officer");
    const [gapData, setGapData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeDomain, setActiveDomain] = useState("All");

    useEffect(() => {
        getRoles()
            .then((r) => setRoles(r))
            .catch(() => {});
    }, []);

    useEffect(() => {
        setLoading(true);
        getMyGaps(selectedRole)
            .then((res) => {
                setGapData(res);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [selectedRole]);

    const gaps = gapData?.gaps || [];
    const filteredGaps = activeDomain === "All"
        ? gaps
        : gaps.filter((g) => g.domain === activeDomain);

    const domains = ["All", "Statistical", "Technical", "Digital Governance"];

    return (
        <main id="main-content" tabIndex={-1} className="flex flex-col gap-8 focus:outline-none p-2 sm:p-6">
            {/* Header with Title and Target Role Selector */}
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-6">
                <div>
                    <div className="flex items-center gap-2 text-primary font-medium text-sm">
                        <MagicIcon className="w-4 h-4" />
                        <span>SAMARTH AI Competency Intelligence</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground mt-1">
                        Skill Gap Analysis & Readiness
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        AI-driven comparison of your current competencies against official statistics role mandates.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Target Role:</span>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                        <SelectTrigger className="w-[260px] bg-background">
                            <SelectValue placeholder="Select target role" />
                        </SelectTrigger>
                        <SelectContent>
                            {roles.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                    {r.title}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </header>

            {/* Top Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs uppercase font-semibold">Role Readiness Score</CardDescription>
                        <CardTitle className="text-4xl font-extrabold text-primary">
                            {gapData?.readinessScore ?? 0}%
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Progress value={gapData?.readinessScore ?? 0} className="h-2 mt-1" />
                        <p className="text-xs text-muted-foreground mt-2">
                            Weighted alignment with {gapData?.targetRole?.title || "Target Role"}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs uppercase font-semibold">Critical Gaps</CardDescription>
                        <CardTitle className="text-3xl font-bold text-destructive flex items-center gap-2">
                            <WarningIcon className="w-6 h-6" />
                            {gapData?.summary?.criticalGapsCount ?? 0}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Competency deficit &ge; 2 proficiency levels</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs uppercase font-semibold">Moderate Gaps</CardDescription>
                        <CardTitle className="text-3xl font-bold text-amber-500">
                            {gapData?.summary?.moderateGapsCount ?? 0}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Requires 1 level upgrade for compliance</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs uppercase font-semibold">Requirements Met</CardDescription>
                        <CardTitle className="text-3xl font-bold text-emerald-600 flex items-center gap-2">
                            <CheckCircleIcon className="w-6 h-6" />
                            {gapData?.summary?.metCount ?? 0}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Skills matching or exceeding role target</p>
                    </CardContent>
                </Card>
            </div>

            {/* Domain Filters & Gap List */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3">
                    <div className="flex items-center gap-2">
                        <FilterIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Domain:</span>
                        <div className="flex flex-wrap gap-2">
                            {domains.map((dom) => (
                                <Button
                                    key={dom}
                                    variant={activeDomain === dom ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setActiveDomain(dom)}
                                    className="h-8 text-xs"
                                >
                                    {dom}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <Link to="/recommendations">
                        <Button variant="secondary" size="sm" className="gap-2">
                            <BookIcon className="w-4 h-4" />
                            <span>View All Recommended Courses</span>
                        </Button>
                    </Link>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-muted-foreground">Calculating competency gaps...</div>
                ) : filteredGaps.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">No competency gaps found in this domain.</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredGaps.map((item) => {
                            const isCritical = item.severity === "critical";
                            const isModerate = item.severity === "moderate";

                            return (
                                <Card
                                    key={item.competencyId}
                                    className={`relative transition-shadow hover:shadow-md ${
                                        isCritical
                                            ? "border-destructive/40"
                                            : isModerate
                                            ? "border-amber-500/40"
                                            : "border-border"
                                    }`}
                                >
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <Badge variant="outline" className="text-[11px] font-mono">
                                                {item.competencyId} &bull; {item.domain}
                                            </Badge>
                                            <Badge
                                                variant={
                                                    isCritical
                                                        ? "destructive"
                                                        : isModerate
                                                        ? "outline"
                                                        : "secondary"
                                                }
                                                className={`text-xs ${
                                                    isModerate
                                                        ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                                        : ""
                                                }`}
                                            >
                                                {isCritical ? "Critical Gap" : isModerate ? "Moderate Gap" : "Target Met"}
                                            </Badge>
                                        </div>
                                        <CardTitle className="text-base font-semibold mt-2">{item.name}</CardTitle>
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
                                                                    ? "bg-amber-400/40 border border-dashed border-amber-500"
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
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}
