import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { ComputerIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/features/auth/components/ConfirmActionDialog";
import { LogoutAllButton } from "@/features/auth/components/LogoutAllButton";
import { SessionRow } from "@/features/auth/components/SessionRow";
import { SettingsLoadError } from "@/features/auth/components/SettingsLoadError";
import { SettingsSkeleton } from "@/features/auth/components/SettingsSkeleton";
import { notify } from "@/features/auth/hooks/useNotify";
import {
    fetchSessions,
    revokeOtherSessions,
    revokeSession,
    selectAllSessions,
    selectOtherSessions,
    selectSessionsError,
    selectSessionsStatus,
} from "@/features/auth/slice/sessionsSlice";
import { errorMessageKey } from "@/lib/apiError";
import { STATUS } from "@/lib/asyncState";

const NOT_FOUND = 404;
const OTHERS = "others";

/**
 * Device list with revoke (doc 08 #19, #20). Four states: skeleton, error with retry, empty, list. A revoke asks first,
 * disables the other controls while it runs, and ends in a toast. A session that is already gone (404) just refreshes the
 * list. Revalidation failures keep the list on screen (FE-93).
 */
export function SessionsPanel() {
    const { t } = useTranslation(["auth", "errors"]);
    const dispatch = useAppDispatch();
    const sessions = useAppSelector(selectAllSessions);
    const others = useAppSelector(selectOtherSessions);
    const status = useAppSelector(selectSessionsStatus);
    const error = useAppSelector(selectSessionsError);
    const [target, setTarget] = useState(null);
    const [confirmOthers, setConfirmOthers] = useState(false);
    const [busy, setBusy] = useState(null);

    useEffect(() => {
        dispatch(fetchSessions());
    }, [dispatch]);

    async function perform(id, work, doneKey) {
        if (busy) return;
        setBusy(id);
        try {
            await work();
            await notify("success", t(doneKey), `sessions-${id}`);
        } catch (failure) {
            dispatch(fetchSessions());
            if (failure?.statusCode !== NOT_FOUND)
                await notify(
                    "error",
                    t(errorMessageKey(failure?.code), {
                        defaultValue: t("errors:codes.UNKNOWN"),
                    }),
                    "sessions-failed"
                );
        } finally {
            setBusy(null);
        }
    }

    const revoke = () =>
        perform(
            target.id,
            () => dispatch(revokeSession({ id: target.id })).unwrap(),
            "settings.sessions.revoked"
        );
    const revokeOthers = () =>
        perform(
            OTHERS,
            () => dispatch(revokeOtherSessions()).unwrap(),
            "settings.sessions.othersDone"
        );

    if (sessions.length === 0 && status === STATUS.FAILED)
        return (
            <SettingsLoadError
                error={error}
                onRetry={() => dispatch(fetchSessions())}
            />
        );
    if (sessions.length === 0 && status !== STATUS.SUCCEEDED)
        return <SettingsSkeleton rows={3} />;

    return (
        <div className="flex flex-col gap-6">
            {sessions.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-6 text-center">
                    <ComputerIcon
                        aria-hidden="true"
                        className="size-6 text-muted-foreground"
                    />
                    <p className="font-medium">
                        {t("settings.sessions.emptyTitle")}
                    </p>
                    <p className="max-w-prose text-muted-foreground">
                        {t("settings.sessions.emptyBody")}
                    </p>
                </div>
            ) : (
                <ul
                    aria-label={t("settings.sessions.listLabel")}
                    className="flex flex-col gap-3"
                >
                    {sessions.map((session) => (
                        <SessionRow
                            key={session.id}
                            session={session}
                            busy={busy === session.id}
                            disabled={busy !== null}
                            onRevoke={setTarget}
                        />
                    ))}
                </ul>
            )}
            <div className="flex flex-wrap gap-3">
                {others.length > 0 && (
                    <Button
                        type="button"
                        variant="outline"
                        disabled={busy !== null}
                        aria-busy={busy === OTHERS}
                        onClick={() => setConfirmOthers(true)}
                    >
                        {t("settings.sessions.others")}
                    </Button>
                )}
                <LogoutAllButton />
            </div>
            <p className="text-sm text-muted-foreground">
                {t("settings.sessions.limit")}
            </p>
            <ConfirmActionDialog
                open={target !== null}
                onOpenChange={(open) => {
                    if (!open) setTarget(null);
                }}
                title={t("settings.sessions.revokeTitle")}
                description={t("settings.sessions.revokeBody", {
                    device:
                        target?.device || t("settings.sessions.unknownDevice"),
                })}
                actionLabel={t("settings.sessions.revokeAction")}
                onConfirm={revoke}
            />
            <ConfirmActionDialog
                open={confirmOthers}
                onOpenChange={setConfirmOthers}
                title={t("settings.sessions.othersTitle")}
                description={t("settings.sessions.othersBody")}
                actionLabel={t("settings.sessions.othersAction")}
                onConfirm={revokeOthers}
            />
        </div>
    );
}
