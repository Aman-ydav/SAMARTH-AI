import { useState, useEffect } from "react";
import { Link } from "react-router";
import { getMyGaps, getRoles } from "../api/competenciesApi";
import { LoadErrorAlert } from "@/components/common/LoadErrorAlert";
import { GapCard } from "@/features/competencies/components/GapCard";
import { toApiError } from "@/lib/apiError";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ArrowUpRightIcon,
    AwardIcon,
    BookIcon,
    CheckCircleIcon,
    FilterIcon,
    MagicIcon,
    WarningIcon,
} from "@/components/icons";

const LOADING = "loading";
const READY = "ready";
const FAILED = "failed";

export default function GapsPage() {
    const [roles, setRoles] = useState([]);
    const [selectedRole, setSelectedRole] = useState("statistical_officer");
    const [gapData, setGapData] = useState(null);
    const [status, setStatus] = useState(LOADING);
    const [error, setError] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [activeDomain, setActiveDomain] = useState("All");
    const loading = status === LOADING;

    // The role picker is a convenience: when the list cannot load, the selector stays empty and the default role still works.
    useEffect(() => {
        let active = true;
        getRoles()
            .then((list) => {
                if (active) setRoles(list);
            })
            .catch(() => {
                if (active) setRoles([]);
            });
        return () => {
            active = false;
        };
    }, []);

    // `active` stops a late answer from landing after a role change or retry; nothing is aborted.
    useEffect(() => {
        let active = true;
        getMyGaps(selectedRole)
            .then((res) => {
                if (!active) return;
                setGapData(res);
                setStatus(READY);
            })
            .catch((failure) => {
                if (!active) return;
                setError(toApiError(failure));
                setStatus(FAILED);
            });
        return () => {
            active = false;
        };
    }, [selectedRole, reloadKey]);

    const changeRole = (role) => {
        setStatus(LOADING);
        setError(null);
        setSelectedRole(role);
    };
    const retry = () => {
        setStatus(LOADING);
        setError(null);
        setReloadKey((key) => key + 1);
    };

    const gaps = gapData?.gaps || [];
    const filteredGaps =
        activeDomain === "All"
            ? gaps
            : gaps.filter((g) => g.domain === activeDomain);

    const domains = ["All", "Statistical", "Technical", "Digital Governance"];

    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="flex flex-col gap-8 focus:outline-none p-2 sm:p-6"
        >
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
                        AI-driven comparison of your current competencies
                        against official statistics role mandates.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                        Target Role:
                    </span>
                    <Select value={selectedRole} onValueChange={changeRole}>
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
                        <CardDescription className="text-xs uppercase font-semibold">
                            Role Readiness Score
                        </CardDescription>
                        <CardTitle className="text-4xl font-extrabold text-primary">
                            {gapData?.readinessScore ?? 0}%
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Progress
                            value={gapData?.readinessScore ?? 0}
                            className="h-2 mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                            Weighted alignment with{" "}
                            {gapData?.targetRole?.title || "Target Role"}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs uppercase font-semibold">
                            Critical Gaps
                        </CardDescription>
                        <CardTitle className="text-3xl font-bold text-destructive flex items-center gap-2">
                            <WarningIcon className="w-6 h-6" />
                            {gapData?.summary?.criticalGapsCount ?? 0}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">
                            Competency deficit &ge; 2 proficiency levels
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs uppercase font-semibold">
                            Moderate Gaps
                        </CardDescription>
                        <CardTitle className="text-3xl font-bold text-warning-subtle-foreground">
                            {gapData?.summary?.moderateGapsCount ?? 0}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">
                            Requires 1 level upgrade for compliance
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs uppercase font-semibold">
                            Requirements Met
                        </CardDescription>
                        <CardTitle className="text-3xl font-bold text-success-subtle-foreground flex items-center gap-2">
                            <CheckCircleIcon className="w-6 h-6" />
                            {gapData?.summary?.metCount ?? 0}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">
                            Skills matching or exceeding role target
                        </p>
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
                                    variant={
                                        activeDomain === dom
                                            ? "default"
                                            : "outline"
                                    }
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

                {status === FAILED ? (
                    <LoadErrorAlert error={error} onRetry={retry} />
                ) : loading ? (
                    <div className="text-center py-12 text-muted-foreground">
                        Calculating competency gaps...
                    </div>
                ) : filteredGaps.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        No competency gaps found in this domain.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredGaps.map((item) => (
                            <GapCard key={item.competencyId} item={item} />
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
