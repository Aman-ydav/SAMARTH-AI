import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { API_ERROR_CODES, errorMessageKey } from "@/lib/apiError";

/**
 * Turns a failed audit call into text (FE-108): the three states the verify and demo calls can end in get a sentence about
 * the screen's own subject (`FORBIDDEN`, the switched-off demo `NOT_FOUND`, `UNPROCESSABLE` for a chain too short for the
 * demo); everything else uses `errors:codes.<CODE>` (`RATE_LIMITED`, ...). Server messages are never shown.
 */
export function useAuditErrorText() {
    const { t } = useTranslation(["admin", "errors"]);
    return useCallback(
        (error) => {
            const code = error?.code;
            if (code === API_ERROR_CODES.FORBIDDEN)
                return t("admin:audit.errors.forbidden");
            if (code === API_ERROR_CODES.NOT_FOUND)
                return t("admin:audit.errors.demoOff");
            if (code === "UNPROCESSABLE")
                return t("admin:audit.errors.notEnough");
            return t(errorMessageKey(code), {
                defaultValue: t("errors:codes.UNKNOWN"),
            });
        },
        [t]
    );
}
