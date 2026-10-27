import { useTranslation } from "react-i18next";
import { RoleBadge } from "@/components/layout/RoleBadge";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/features/admin/components/StatusBadge";
import { UserActionsMenu } from "@/features/admin/components/UserActionsMenu";
import { formatDateTime } from "@/lib/format";

/**
 * Accounts as a table. Names and emails are server text rendered as plain text (FE-97) and wrap instead of overflowing.
 * Your own row carries a "You" badge. `busyId` marks the row with a running action and disables every row menu.
 */
export function UsersTable({ actor, users, busyId, onStatus, onChangeRole }) {
    const { t, i18n } = useTranslation("admin");
    const language = i18n.language;

    return (
        <Table>
            <TableCaption className="sr-only">
                {t("users.table.caption")}
            </TableCaption>
            <TableHeader className="bg-muted">
                <TableRow>
                    <TableHead>{t("users.table.name")}</TableHead>
                    <TableHead>{t("users.table.email")}</TableHead>
                    <TableHead>{t("users.table.role")}</TableHead>
                    <TableHead>{t("users.table.status")}</TableHead>
                    <TableHead>{t("users.table.lastSignIn")}</TableHead>
                    <TableHead>{t("users.table.actions")}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {users.map((user) => (
                    <TableRow key={user.id}>
                        <TableCell className="max-w-56 wrap-break-word whitespace-normal">
                            <span className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">
                                    {user.name || t("users.table.noName")}
                                </span>
                                {actor?.id === user.id && (
                                    <Badge variant="outline">
                                        {t("users.table.you")}
                                    </Badge>
                                )}
                            </span>
                        </TableCell>
                        <TableCell className="max-w-64 wrap-break-word whitespace-normal">
                            {user.email}
                        </TableCell>
                        <TableCell>
                            <RoleBadge role={user.role} />
                        </TableCell>
                        <TableCell>
                            <StatusBadge kind="user" status={user.status} />
                        </TableCell>
                        <TableCell>
                            {user.lastLoginAt ? (
                                <time dateTime={user.lastLoginAt}>
                                    {formatDateTime(user.lastLoginAt, language)}
                                </time>
                            ) : (
                                t("users.table.never")
                            )}
                        </TableCell>
                        <TableCell>
                            {busyId === user.id ? (
                                <Spinner />
                            ) : (
                                <UserActionsMenu
                                    actor={actor}
                                    user={user}
                                    name={user.name || user.email}
                                    disabled={busyId !== null}
                                    onStatus={onStatus}
                                    onChangeRole={onChangeRole}
                                />
                            )}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
