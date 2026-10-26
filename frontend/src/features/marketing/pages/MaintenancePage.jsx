import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { ToolsIcon } from "@/components/icons";
import { StatePage } from "@/features/marketing/components/StatePage";
import { useCountdown } from "@/hooks/useCountdown";
import { formatDateTime } from "@/lib/format";
import { PATHS } from "@/lib/paths";
import { safeReturnPath } from "@/lib/safeRedirect";

const RETRY_SECONDS = 30;

/**
 * `/maintenance`. The app retries every 30 seconds (docs/23 section 2.1): when the countdown ends, or the user
 * presses "Check again", it goes back to where it came from (`state.from`, validated) or to home. If the API is
 * still down the app lands here again. `state.until` (ISO date) optionally shows the expected return time.
 */
export default function MaintenancePage() {
    const { t, i18n } = useTranslation("errors");
    const navigate = useNavigate();
    const { state } = useLocation();
    const { remainingSec, startFor } = useCountdown();
    const armed = useRef(false);

    const checkAgain = () =>
        navigate(safeReturnPath(state?.from, PATHS.home), { replace: true });

    useEffect(() => {
        startFor(RETRY_SECONDS);
    }, [startFor]);

    useEffect(() => {
        if (remainingSec > 0) {
            armed.current = true;
        } else if (armed.current) {
            armed.current = false;
            navigate(safeReturnPath(state?.from, PATHS.home), {
                replace: true,
            });
        }
    }, [remainingSec, navigate, state]);

    const returnTime = state?.until
        ? formatDateTime(state.until, i18n.language)
        : "";

    return (
        <StatePage
            icon={ToolsIcon}
            title={t("maintenance.title")}
            body={t("maintenance.body")}
            primary={{ label: t("maintenance.primary"), onClick: checkAgain }}
            secondary={{ label: t("maintenance.secondary"), to: PATHS.home }}
        >
            {returnTime ? (
                <p className="type-small text-muted-foreground">
                    {t("pages.maintenance.returnAt", { time: returnTime })}
                </p>
            ) : null}
            {remainingSec > 0 ? (
                <p className="type-small text-muted-foreground">
                    {t("pages.maintenance.autoRetry", {
                        seconds: remainingSec,
                    })}
                </p>
            ) : null}
        </StatePage>
    );
}
