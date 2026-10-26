import { useTranslation } from "react-i18next";
import { CookieIcon } from "@/components/icons";
import { StatePage } from "@/features/marketing/components/StatePage";
import { useCookiesEnabled } from "@/features/marketing/hooks/useCookiesEnabled";
import { PATHS } from "@/lib/paths";

/**
 * `/cookies-disabled`. The page is also the destination of the cookie check on login and signup. It re-reads
 * `navigator.cookieEnabled`: when cookies are off it explains how to turn them on and offers a reload; when they
 * are on it says so and links to sign in.
 */
export default function CookiesDisabledPage() {
    const { t } = useTranslation("errors");
    const { enabled, recheck } = useCookiesEnabled();
    const steps = t("pages.cookiesDisabled.steps", { returnObjects: true });

    if (enabled) {
        return (
            <StatePage
                icon={CookieIcon}
                title={t("cookiesDisabled.title")}
                body={t("pages.cookiesDisabled.enabledNow")}
                primary={{
                    label: t("pages.cookiesDisabled.enabledAction"),
                    to: PATHS.login,
                }}
                secondary={{
                    label: t("cookiesDisabled.secondary"),
                    to: `${PATHS.privacy}#cookies`,
                }}
            />
        );
    }

    return (
        <StatePage
            icon={CookieIcon}
            title={t("cookiesDisabled.title")}
            body={t("cookiesDisabled.body")}
            primary={{
                label: t("cookiesDisabled.primary"),
                onClick: () => {
                    if (recheck()) return;
                    globalThis.location.reload();
                },
            }}
            secondary={{
                label: t("cookiesDisabled.secondary"),
                to: `${PATHS.privacy}#cookies`,
            }}
        >
            <section className="w-full text-left">
                <h2 className="type-h4">
                    {t("pages.cookiesDisabled.stepsTitle")}
                </h2>
                <ol className="type-small mt-2 list-decimal space-y-1 ps-5 text-muted-foreground">
                    {Array.isArray(steps)
                        ? steps.map((step) => <li key={step}>{step}</li>)
                        : null}
                </ol>
            </section>
        </StatePage>
    );
}
