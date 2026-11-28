import { useTranslation } from "react-i18next";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";

const HASH_PREFIX = 12;
const ID_SUFFIX = 8;
// An id's first characters are the creation time, so every id of a day looks alike; the last ones tell them apart.
const shortId = (id) => id.slice(-ID_SUFFIX);

/**
 * Audit entries as a table, newest first. Ids and hashes are shown shortened in a monospace face (the full hash is the
 * tooltip); all of it is server text rendered as plain text (FE-97). `showOrganisation` adds the organisation column, which
 * only a platform admin receives from the API.
 */
export function AuditTable({ entries, showOrganisation = false }) {
    const { t, i18n } = useTranslation("admin");
    const language = i18n.language;

    return (
        <Table>
            <TableCaption className="sr-only">
                {t("audit.table.caption")}
            </TableCaption>
            <TableHeader className="bg-muted">
                <TableRow>
                    <TableHead>{t("audit.table.seq")}</TableHead>
                    <TableHead>{t("audit.table.time")}</TableHead>
                    <TableHead>{t("audit.table.action")}</TableHead>
                    <TableHead>{t("audit.table.actor")}</TableHead>
                    <TableHead>{t("audit.table.entity")}</TableHead>
                    {showOrganisation && (
                        <TableHead>{t("audit.table.organisation")}</TableHead>
                    )}
                    <TableHead>{t("audit.table.hash")}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {entries.map((entry) => (
                    <TableRow key={entry.id}>
                        <TableCell className="tabular-nums">
                            {entry.seq}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                            <time dateTime={entry.at ?? undefined}>
                                {formatDateTime(entry.at, language)}
                            </time>
                        </TableCell>
                        <TableCell className="font-mono type-caption break-all whitespace-normal">
                            {entry.action}
                        </TableCell>
                        <TableCell className="font-mono type-caption">
                            {entry.actorId ? (
                                shortId(entry.actorId)
                            ) : (
                                <span className="font-sans text-muted-foreground">
                                    {t("audit.table.system")}
                                </span>
                            )}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                            <span className="flex flex-wrap items-center gap-2">
                                <span>{entry.entityType}</span>
                                {entry.entityId && (
                                    <span className="font-mono type-caption text-muted-foreground">
                                        {shortId(entry.entityId)}
                                    </span>
                                )}
                            </span>
                        </TableCell>
                        {showOrganisation && (
                            <TableCell className="font-mono type-caption">
                                {entry.orgId ? shortId(entry.orgId) : ""}
                            </TableCell>
                        )}
                        <TableCell
                            className="font-mono type-caption"
                            title={entry.hash}
                        >
                            {entry.hash.slice(0, HASH_PREFIX)}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
