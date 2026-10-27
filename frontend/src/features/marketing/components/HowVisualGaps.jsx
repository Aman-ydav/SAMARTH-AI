import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { MockLevelBar } from "@/features/marketing/components/MockLevelBar";
import { MockWindow } from "@/features/marketing/components/MockWindow";
import { gapRows } from "@/features/marketing/data/heroMock";
import { cn } from "@/lib/utils";

const PRIORITY_VARIANT = {
    high: "destructive",
    medium: "warning",
    low: "secondary",
};
const IMPORTANCE = { 3: "high", 2: "medium", 1: "low" };

/** Gap step: ranked table where each bar fills to the current level and the difference to the role level shows. */
export function HowVisualGaps({ t, active }) {
    const rows = gapRows(false).slice(0, 5);
    return (
        <MockWindow
            title={t("how.visual.window.gaps")}
            demoLabel={t("how.visual.demo")}
        >
            <div className="p-2">
                <Table>
                    <TableHeader>
                        <TableRow className="h-9">
                            <TableHead className="h-9 type-caption">
                                {t("how.visual.gaps.competency")}
                            </TableHead>
                            <TableHead className="h-9 type-caption">
                                {t("how.visual.gaps.now")} /{" "}
                                {t("how.visual.gaps.needed")}
                            </TableHead>
                            <TableHead className="h-9 text-right type-caption">
                                {t("how.visual.gaps.gap")}
                            </TableHead>
                            <TableHead className="h-9 type-caption">
                                {t("how.visual.gaps.priority")}
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row) => (
                            <TableRow
                                key={row.id}
                                className={cn(
                                    "h-16 transition-opacity duration-500 motion-reduce:transition-none",
                                    active ? "opacity-100" : "opacity-60"
                                )}
                            >
                                <TableCell className="min-w-0">
                                    <p className="type-small font-medium">
                                        {t(`hero.mock.competencies.${row.id}`)}
                                    </p>
                                    <p className="type-caption text-muted-foreground">
                                        {t("how.visual.gaps.why", {
                                            gap: row.gap,
                                            importance: t(
                                                `how.visual.importance.${IMPORTANCE[row.importance]}`
                                            ),
                                        })}
                                    </p>
                                </TableCell>
                                <TableCell className="w-40">
                                    <MockLevelBar
                                        level={active ? row.current : 0}
                                        required={row.required}
                                        showRequired={active}
                                    />
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums">
                                    {row.gap}
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={PRIORITY_VARIANT[row.priority]}
                                    >
                                        {t(
                                            `hero.mock.priority.${row.priority}`
                                        )}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <p className="px-2 pt-2 type-caption text-muted-foreground">
                    {t("how.visual.gaps.note")}
                </p>
            </div>
        </MockWindow>
    );
}
