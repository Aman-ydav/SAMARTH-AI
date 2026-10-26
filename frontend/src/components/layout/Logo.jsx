import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const WORD = "SAMARTH";
const SUFFIX = "AI";

/**
 * SAMARTH AI mark and wordmark (docs/23 section 1.4): a flat rounded square holding an "S" with three ascending
 * bars (competency levels), plus "SAMARTH" in the display face and "AI" in mono. Colours come from tokens only.
 * It renders no link: wrap it in a `Link` where needed. The accessible name is always the brand name, even when
 * the wordmark is hidden (collapsed sidebar). Hindi pages keep the Latin wordmark.
 */
export function Logo({ className, showWordmark = true }) {
    const { t } = useTranslation("common");
    const name = t("brand.name");

    return (
        <span className={cn("inline-flex h-8 items-center gap-2", className)}>
            <svg
                viewBox="0 0 32 32"
                className="size-8 shrink-0"
                focusable="false"
                role={showWordmark ? undefined : "img"}
                aria-label={showWordmark ? undefined : name}
                aria-hidden={showWordmark ? "true" : undefined}
            >
                <rect width="32" height="32" rx="6" className="fill-primary" />
                <text
                    x="9.5"
                    y="23"
                    textAnchor="middle"
                    fontSize="20"
                    fontWeight="600"
                    className="fill-primary-foreground font-display"
                >
                    S
                </text>
                <rect
                    x="17"
                    y="19"
                    width="3"
                    height="6"
                    rx="1"
                    className="fill-primary-foreground"
                />
                <rect
                    x="21"
                    y="15"
                    width="3"
                    height="10"
                    rx="1"
                    className="fill-primary-foreground"
                />
                <rect
                    x="25"
                    y="11"
                    width="3"
                    height="14"
                    rx="1"
                    className="fill-primary-foreground"
                />
            </svg>
            {showWordmark ? (
                <>
                    <span className="sr-only">{name}</span>
                    <span
                        aria-hidden="true"
                        className="flex items-baseline gap-1 text-lg leading-none"
                    >
                        <span className="font-display font-semibold tracking-[0.04em] text-foreground uppercase">
                            {WORD}
                        </span>
                        <span className="font-mono text-xs font-medium text-primary-text">
                            {SUFFIX}
                        </span>
                    </span>
                </>
            ) : null}
        </span>
    );
}
