import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { API_ERROR_CODES, errorMessageKey } from "@/lib/apiError";

const KEYS = Object.freeze({
    invites: {
        conflict: "admin:invites.errors.conflict",
        notFound: "admin:invites.errors.notFound",
        unprocessable: "admin:invites.resend.capReached",
    },
    users: {
        conflict: "admin:users.errors.conflict",
        notFound: "admin:users.errors.notFound",
        forbidden: "admin:users.errors.forbidden",
    },
});

/**
 * Turns a failed admin call into text (FE-108): the states every admin write can end in (`CONFLICT`, `NOT_FOUND`, the resend
 * cap `UNPROCESSABLE`, a refused account `FORBIDDEN`) get a sentence about the screen's own subject, everything else uses
 * `errors:codes.<CODE>` (`SELF_ACTION_FORBIDDEN`, `LAST_ADMIN`, `RATE_LIMITED`, ...). Server messages are never shown.
 * `scope` is `invites` or `users`.
 */
export function useAdminErrorText(scope) {
    const { t } = useTranslation(["admin", "errors"]);
    return useCallback(
        (error) => {
            const keys = KEYS[scope];
            const code = error?.code;
            const own =
                (code === API_ERROR_CODES.CONFLICT && keys.conflict) ||
                (code === API_ERROR_CODES.NOT_FOUND && keys.notFound) ||
                (code === "UNPROCESSABLE" && keys.unprocessable) ||
                (code === API_ERROR_CODES.FORBIDDEN && keys.forbidden);
            if (own) return t(own);
            return t(errorMessageKey(code), {
                defaultValue: t("errors:codes.UNKNOWN"),
            });
        },
        [t, scope]
    );
}
