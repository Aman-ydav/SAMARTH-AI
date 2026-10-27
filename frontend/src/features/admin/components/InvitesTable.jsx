import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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
import { formatDate } from "@/lib/format";
import { roleLabelKey } from "@/lib/roleLabels";

/** The server allows at most five resends per invitation (R69); the sixth answers 422. */
export const MAX_RESENDS = 5;
const OPEN_STATUSES = new Set(["sent", "expired"]);

function InviteDate({ value, language }) {
    return value ? (
        <time dateTime={value}>{formatDate(value, language)}</time>
    ) : (
        <span aria-hidden="true">-</span>
    );
}

/**
 * Invitations as a table with the two row actions. Only open invitations (sent, or sent and lapsed) can be resent or
 * revoked; accepted and revoked ones have no action because the API would answer 409. At the resend cap the button is
 * disabled and the row says why. While one action runs, `busyId` marks its row and every control is disabled (FE-77).
 */
export function InvitesTable({ invites, busyId, onResend, onRevoke }) {
    const { t, i18n } = useTranslation("admin");
    const language = i18n.language;
    const working = busyId !== null;

    return (
        <Table>
            <TableCaption className="sr-only">
                {t("invites.list.caption")}
            </TableCaption>
            <TableHeader className="bg-muted">
                <TableRow>
                    <TableHead>{t("invites.table.email")}</TableHead>
                    <TableHead>{t("invites.table.role")}</TableHead>
                    <TableHead>{t("invites.table.status")}</TableHead>
                    <TableHead>{t("invites.table.sent")}</TableHead>
                    <TableHead>{t("invites.table.expires")}</TableHead>
                    <TableHead>{t("invites.table.actions")}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {invites.map((invite) => {
                    const open = OPEN_STATUSES.has(invite.status);
                    const capped = invite.resentCount >= MAX_RESENDS;
                    const busy = busyId === invite.id;
                    const capId = `invite-cap-${invite.id}`;
                    return (
                        <TableRow key={invite.id}>
                            <TableCell className="max-w-64 wrap-break-word whitespace-normal">
                                <span className="font-medium">
                                    {invite.email}
                                </span>
                                {open && invite.resentCount > 0 && (
                                    <span className="type-caption block text-muted-foreground">
                                        {t("invites.table.resends", {
                                            used: invite.resentCount,
                                            max: MAX_RESENDS,
                                        })}
                                    </span>
                                )}
                            </TableCell>
                            <TableCell>
                                {t(roleLabelKey(invite.role))}
                            </TableCell>
                            <TableCell>
                                <StatusBadge
                                    kind="invite"
                                    status={invite.status}
                                />
                            </TableCell>
                            <TableCell>
                                <InviteDate
                                    value={invite.createdAt}
                                    language={language}
                                />
                            </TableCell>
                            <TableCell>
                                <InviteDate
                                    value={invite.expiresAt}
                                    language={language}
                                />
                            </TableCell>
                            <TableCell className="whitespace-normal">
                                {open && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            disabled={working || capped}
                                            aria-busy={busy}
                                            aria-describedby={
                                                capped ? capId : undefined
                                            }
                                            aria-label={t(
                                                "invites.actions.resendLabel",
                                                { email: invite.email }
                                            )}
                                            onClick={() => onResend(invite)}
                                        >
                                            {busy && <Spinner />}
                                            {t("invites.actions.resend")}
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            disabled={working}
                                            aria-label={t(
                                                "invites.actions.revokeLabel",
                                                { email: invite.email }
                                            )}
                                            onClick={() => onRevoke(invite)}
                                        >
                                            {t("invites.actions.revoke")}
                                        </Button>
                                        {capped && (
                                            <p
                                                id={capId}
                                                className="type-caption w-full text-muted-foreground"
                                            >
                                                {t(
                                                    "invites.actions.capReached",
                                                    {
                                                        max: MAX_RESENDS,
                                                    }
                                                )}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}
