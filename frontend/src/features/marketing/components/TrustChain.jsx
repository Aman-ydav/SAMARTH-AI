import { useTranslation } from "react-i18next";
import { CheckCircleIcon } from "@/components/icons";
import { ChainReveal } from "@/components/motion/ChainReveal";
import { Badge } from "@/components/ui/badge";
import { CHAIN_BLOCKS } from "@/features/marketing/data/landingContent";
import { cn } from "@/lib/utils";

function Block({ block, index, t }) {
    return (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
            <p className="type-caption font-medium text-card-foreground">
                {t("trust.chain.entry", { number: index + 1 })}
            </p>
            <dl className="font-mono type-caption text-muted-foreground">
                <div className="flex gap-1">
                    <dt>{t("trust.chain.prev")}</dt>
                    <dd className="text-card-foreground">{block.prev}</dd>
                </div>
                <div className="flex gap-1">
                    <dt>{t("trust.chain.hash")}</dt>
                    <dd className="text-card-foreground">{block.hash}</dd>
                </div>
            </dl>
            <Badge variant="success" className="w-fit">
                <CheckCircleIcon aria-hidden="true" />
                {t("trust.chain.verified")}
            </Badge>
        </div>
    );
}

/**
 * Story beat 6 (CHAIN_REVEAL): four audit entries link up as you scroll, each naming the hash of the one before it.
 * An illustration with made-up hashes, labelled as such; it does not imply a real ledger (ANIM-48).
 */
export function TrustChain({ className }) {
    const { t } = useTranslation("landing");
    return (
        <figure className={cn("flex flex-col gap-3", className)}>
            <ChainReveal
                items={CHAIN_BLOCKS}
                renderItem={(block, index) => (
                    <Block block={block} index={index} t={t} />
                )}
            />
            <figcaption className="type-caption text-muted-foreground">
                {t("trust.chain.label")}
            </figcaption>
        </figure>
    );
}
