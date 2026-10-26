import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { WifiOffIcon } from "@/components/icons";
import { StatePage } from "@/features/marketing/components/StatePage";
import { useOnline } from "@/hooks/useOnline";
import { PATHS } from "@/lib/paths";
import { safeReturnPath } from "@/lib/safeRedirect";

/**
 * `/offline`. Reads the live online state (FE-42). Coming back online while this page is open returns the user to
 * where they came from (`state.from`, validated) or home; "Retry" does the same when already online and
 * otherwise says the connection is still down.
 */
export default function OfflinePage() {
    const { t } = useTranslation("errors");
    const navigate = useNavigate();
    const { state } = useLocation();
    const online = useOnline();
    const [stillOffline, setStillOffline] = useState(false);
    const wasOffline = useRef(!online);

    useEffect(() => {
        if (!online) {
            wasOffline.current = true;
        } else if (wasOffline.current) {
            wasOffline.current = false;
            navigate(safeReturnPath(state?.from, PATHS.home), {
                replace: true,
            });
        }
    }, [online, navigate, state]);

    function retry() {
        if (online) {
            navigate(safeReturnPath(state?.from, PATHS.home), {
                replace: true,
            });
        } else {
            setStillOffline(true);
        }
    }

    return (
        <StatePage
            icon={WifiOffIcon}
            title={t("offline.title")}
            body={t("offline.body")}
            primary={{ label: t("offline.primary"), onClick: retry }}
        >
            <p role="status" className="type-small text-muted-foreground">
                {online
                    ? t("pages.offline.backOnline")
                    : stillOffline
                      ? t("pages.offline.stillOffline")
                      : null}
            </p>
        </StatePage>
    );
}
