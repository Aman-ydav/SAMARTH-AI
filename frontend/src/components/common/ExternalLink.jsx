import { useTranslation } from "react-i18next";
import { ExternalLinkIcon } from "@/components/icons";
import { safeExternalUrl } from "@/lib/safeUrl";
import { cn } from "@/lib/utils";

export function ExternalLink({ href, className, children, ...props }) {
    const { t } = useTranslation("common");
    const safeHref = safeExternalUrl(href);

    if (!safeHref) return <span className={className}>{children}</span>;

    return (
        <a
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                "inline-flex items-center gap-1 rounded-sm underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                className
            )}
            {...props}
        >
            {children}
            <ExternalLinkIcon aria-hidden="true" className="size-4" />
            <span className="sr-only">{t("opensInNewTab")}</span>
        </a>
    );
}
