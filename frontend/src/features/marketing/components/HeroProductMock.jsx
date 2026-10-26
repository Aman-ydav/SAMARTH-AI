import { useTranslation } from "react-i18next";
import { UserIcon } from "@/components/icons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    MAX_LEVEL,
    MOCK_COMPETENCIES,
    MOCK_PATH,
    rankedGaps,
} from "@/features/marketing/data/heroMock";

function LevelsCard({ t }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("hero.mock.levelsTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {MOCK_COMPETENCIES.map((item) => (
                    <div key={item.id} className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-2 type-small">
                            <span className="text-card-foreground">
                                {t(`hero.mock.competencies.${item.id}`)}
                            </span>
                            <span className="font-mono tabular-nums text-muted-foreground">
                                {item.current}/{item.required}
                            </span>
                        </div>
                        <Progress value={(item.current / MAX_LEVEL) * 100} />
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

function GapsCard({ t }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("hero.mock.gapsTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>
                                {t("hero.mock.columnCompetency")}
                            </TableHead>
                            <TableHead className="text-right">
                                {t("hero.mock.columnGap")}
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rankedGaps().map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>
                                    {t(`hero.mock.competencies.${item.id}`)}
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums">
                                    {item.gap}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function PathCard({ t }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("hero.mock.pathTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
                <ol className="flex flex-col gap-3">
                    {MOCK_PATH.map((id, index) => (
                        <li key={id} className="flex items-start gap-3">
                            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent font-mono type-caption text-accent-foreground">
                                {index + 1}
                            </span>
                            <div className="flex min-w-0 flex-col gap-1">
                                <span className="type-small text-card-foreground">
                                    {t(`hero.mock.path.${id}`)}
                                </span>
                                <Badge variant="secondary" className="w-fit">
                                    {t("hero.mock.simulated")}
                                </Badge>
                            </div>
                        </li>
                    ))}
                </ol>
            </CardContent>
        </Card>
    );
}

/**
 * Flat learner-dashboard mock built from real shadcn components and fixture data (ANIM-61). The mock is
 * `aria-hidden` and `inert`; a visually hidden caption describes it for assistive technology.
 */
export function HeroProductMock() {
    const { t } = useTranslation("landing");
    return (
        <figure className="mx-auto w-full max-w-5xl">
            <figcaption className="sr-only">
                {t("hero.mock.description")}
            </figcaption>
            <div
                aria-hidden="true"
                inert
                className="rounded-lg border border-border bg-card p-4 sm:p-6"
            >
                <div className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
                    <Avatar size="lg">
                        <AvatarFallback>
                            <UserIcon className="size-5" />
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                        <p className="type-h4 text-card-foreground">
                            {t("hero.mock.title")}
                        </p>
                        <p className="type-small text-muted-foreground">
                            {t("hero.mock.persona")}
                        </p>
                    </div>
                    <Badge variant="info">{t("hero.mock.demo")}</Badge>
                </div>
                <div className="grid gap-4 pt-4 md:grid-cols-3">
                    <LevelsCard t={t} />
                    <GapsCard t={t} />
                    <PathCard t={t} />
                </div>
            </div>
        </figure>
    );
}
