import { useCallback } from "react";
import { useTranslation } from "react-i18next";

/**
 * Translates a form message. Zod and server-error messages are i18n keys (`validation:email.invalid`,
 * `errors:codes.PASSWORD_POLICY`); a server-supplied field message that is not a key is shown as-is
 * (FE-108 allows server text for field validation only).
 */
export function useFormMessage() {
    const { t } = useTranslation();
    return useCallback(
        (message) =>
            typeof message === "string" && message
                ? t(message, { defaultValue: message })
                : "",
        [t]
    );
}
