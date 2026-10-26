import { useTranslation } from "react-i18next";
import { CheckCircleIcon, ComputerIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/format";

/**
 * One logged-in device. The device text is the server summary (for example "Chrome on Windows") rendered as plain text.
 * The current device carries a badge and cannot be revoked here (use Log out). Times are relative with the exact time
 * in a tooltip and in the `time` element.
 */
export function SessionRow({ session, busy, disabled, onRevoke }) {
    const { t, i18n } = useTranslation("auth");
    const device = session.device || t("settings.sessions.unknownDevice");
    const language = i18n.language;

    return (
        <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
                <ComputerIcon
                    aria-hidden="true"
                    className="mt-0.5 size-6 shrink-0 text-muted-foreground"
                />
                <div className="flex min-w-0 flex-col gap-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                        <span className="wrap-break-word">{device}</span>
                        {session.current && (
                            <Badge variant="success">
                                <CheckCircleIcon aria-hidden="true" />
                                {t("settings.sessions.current")}
                            </Badge>
                        )}
                    </p>
                    {session.lastUsedAt && (
                        <p className="text-sm text-muted-foreground">
                            <time
                                dateTime={session.lastUsedAt}
                                title={formatDateTime(
                                    session.lastUsedAt,
                                    language
                                )}
                            >
                                {t("settings.sessions.lastActive", {
                                    time: formatRelativeTime(
                                        session.lastUsedAt,
                                        language
                                    ),
                                })}
                            </time>
                        </p>
                    )}
                    {session.createdAt && (
                        <p className="type-caption text-muted-foreground">
                            {t("settings.sessions.loggedInAt", {
                                date: formatDate(session.createdAt, language),
                            })}
                        </p>
                    )}
                </div>
            </div>
            {!session.current && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={disabled}
                    aria-busy={busy}
                    aria-label={t("settings.sessions.revokeLabel", { device })}
                    onClick={() => onRevoke(session)}
                >
                    {busy && <Spinner />}
                    {t("settings.sessions.revoke")}
                </Button>
            )}
        </li>
    );
}
