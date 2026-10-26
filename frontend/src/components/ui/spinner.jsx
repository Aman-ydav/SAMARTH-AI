import { useTranslation } from "react-i18next";
import { SpinnerIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

function Spinner({ className, ...props }) {
    const { t } = useTranslation("common");

    return (
        <SpinnerIcon
            data-slot="spinner"
            role="status"
            aria-label={t("loading")}
            className={cn("size-4 motion-safe:animate-spin", className)}
            {...props}
        />
    );
}

export { Spinner };
