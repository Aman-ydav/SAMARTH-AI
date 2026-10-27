import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { gapRows } from "@/features/marketing/data/heroMock";
import { cn } from "@/lib/utils";

const PRIORITY_VARIANT = {
    high: "destructive",
    medium: "warning",
    low: "secondary",
};

/** Ranked gap table with priority badges. The order is fixed; only the privacy row changes after the quiz. */
export function MockGapsCard({ t, view }) {
    const rows = gapRows(view.evidence).slice(0, 5);
    return (
        <Card className="h-72 gap-2 overflow-clip [--card-spacing:--spacing(3)]">
            <CardHeader>
                <CardTitle>{t("hero.mock.gaps.title")}</CardTitle>
            </CardHeader>
            <div
                className={cn(
                    "px-3 transition-opacity duration-500 motion-reduce:transition-none",
                    view.required ? "opacity-100" : "opacity-40"
                )}
            >
                <Table>
                    <TableHeader>
                        <TableRow className="h-8">
                            <TableHead className="h-8 px-2 type-caption">
                                {t("hero.mock.gaps.competency")}
                            </TableHead>
                            <TableHead className="h-8 px-2 text-right type-caption">
                                {t("hero.mock.gaps.gap")}
                            </TableHead>
                            <TableHead className="h-8 px-2 type-caption">
                                {t("hero.mock.gaps.priority")}
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row) => (
                            <TableRow key={row.id} className="h-11">
                                <TableCell className="px-2 py-1 type-small">
                                    {t(`hero.mock.competencies.${row.id}`)}
                                </TableCell>
                                <TableCell className="px-2 py-1 text-right font-mono tabular-nums">
                                    {row.gap}
                                </TableCell>
                                <TableCell className="px-2 py-1">
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
            </div>
        </Card>
    );
}
