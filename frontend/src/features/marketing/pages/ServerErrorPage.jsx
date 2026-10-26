import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { ErrorWarningIcon } from "@/components/icons";
import { StatePage } from "@/features/marketing/components/StatePage";
import { PATHS } from "@/lib/paths";

const REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

/** Only a short, id-shaped string is shown; nothing else from an error ever reaches the screen (FE-108). */
function pickRequestId(...candidates) {
    for (const candidate of candidates) {
        if (typeof candidate === "string" && REQUEST_ID.test(candidate))
            return candidate;
    }
    return null;
}

/**
 * `/server-error`. Shows no error details, only the request id when the caller supplies one, either as the
 * `error` prop (an ApiError or router error) or as `requestId` in the navigation state.
 */
export default function ServerErrorPage({ error }) {
    const { t } = useTranslation("errors");
    const navigate = useNavigate();
    const location = useLocation();
    const requestId = pickRequestId(
        error?.requestId,
        location.state?.requestId
    );
    const canGoBack = location.key !== "default";

    return (
        <StatePage
            icon={ErrorWarningIcon}
            title={t("serverError.title")}
            body={t("serverError.body")}
            primary={{
                label: t("serverError.primary"),
                onClick: () => navigate(canGoBack ? -1 : PATHS.home),
            }}
            secondary={{ label: t("serverError.secondary"), to: PATHS.home }}
        >
            {requestId ? (
                <p className="type-code rounded-md bg-muted px-3 py-1.5 text-muted-foreground">
                    {t("requestId", { id: requestId })}
                </p>
            ) : null}
        </StatePage>
    );
}
