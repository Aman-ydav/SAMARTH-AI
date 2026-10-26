import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CloseIcon, InfoIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

/**
 * Prototype disclaimer banner at the top of the app content (DECISIONS section 1). Dismissible for the visit only:
 * the state lives in the component, so it returns after a reload (nothing is stored).
 */
export function PrototypeNotice() {
    const { t } = useTranslation(["nav", "common"]);
    const [dismissed, setDismissed] = useState(false);

    if (dismissed) return null;
    return (
        <div
            role="note"
            className="border-b border-info-border bg-info-subtle text-info-subtle-foreground"
        >
            <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-1.5 sm:px-6 lg:px-8">
                <InfoIcon className="size-4 shrink-0" aria-hidden="true" />
                <p className="flex-1 text-sm">{t("common:prototypeNotice")}</p>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("nav:shell.dismissNotice")}
                    onClick={() => setDismissed(true)}
                >
                    <CloseIcon aria-hidden="true" />
                </Button>
            </div>
        </div>
    );
}
