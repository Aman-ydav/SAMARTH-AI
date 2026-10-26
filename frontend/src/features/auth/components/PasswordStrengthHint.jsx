import { useTranslation } from "react-i18next";
import { CheckCircleIcon, CircleIcon } from "@/components/icons";
import {
    PASSWORD_MAX_BYTES,
    evaluatePasswordPolicy,
} from "@/features/auth/schemas/authSchemas";
import { utf8ByteLength } from "@/lib/forms";
import { cn } from "@/lib/utils";

const RULES = [
    { key: "minLength", label: "validation:password.policyMinLength" },
    { key: "maxBytes", label: "validation:password.policyMaxBytes" },
    { key: "notCommon", label: "validation:password.policyNotCommon" },
    { key: "noPersonal", label: "validation:password.policyNoPersonal" },
];

/**
 * Live checklist of the password policy (doc 20 section 12) plus a UTF-8 byte meter, because the server limit
 * is 72 bytes, not characters (R4). Met rules use a check icon and a text label, never colour alone (UI-07).
 */
export function PasswordStrengthHint({ password = "", email = "", name = "" }) {
    const { t } = useTranslation("auth");
    const result = evaluatePasswordPolicy(password, { email, name });
    const used = utf8ByteLength(password);
    const over = Math.max(0, used - PASSWORD_MAX_BYTES);
    const started = password.length > 0;

    return (
        <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
            <p className="font-medium">{t("passwordHint.title")}</p>
            <ul className="mt-2 flex flex-col gap-1">
                {RULES.map(({ key, label }) => {
                    const met = started && result[key];
                    const Icon = met ? CheckCircleIcon : CircleIcon;
                    return (
                        <li
                            key={key}
                            className={cn(
                                "flex items-center gap-2",
                                met
                                    ? "text-foreground"
                                    : "text-muted-foreground"
                            )}
                        >
                            <Icon
                                aria-hidden="true"
                                className="size-4 shrink-0"
                            />
                            <span>{t(label)}</span>
                            <span className="sr-only">
                                {met
                                    ? t("passwordHint.met")
                                    : t("passwordHint.unmet")}
                            </span>
                        </li>
                    );
                })}
            </ul>
            <p className="mt-2 font-mono tabular-nums type-caption text-muted-foreground">
                {t("passwordHint.bytes", { used, max: PASSWORD_MAX_BYTES })}
            </p>
            <p
                aria-live="polite"
                className={over > 0 ? "mt-1 text-destructive" : "sr-only"}
            >
                {over > 0 ? t("passwordHint.bytesOver", { count: over }) : ""}
            </p>
        </div>
    );
}
