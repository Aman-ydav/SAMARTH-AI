import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ArrowRightIcon, ShieldIcon } from "@/components/icons";
import { Reveal } from "@/components/motion/Reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrustChain } from "@/features/marketing/components/TrustChain";
import {
    LANDING_LINKS,
    TRUST_ITEMS,
} from "@/features/marketing/data/landingContent";
import { STAGGER } from "@/lib/motionTokens";

/** Security and privacy by design (CHAIN_REVEAL audit blocks, REVEAL_ON_VIEW list). Honest about designed vs built. */
export function TrustSection() {
    const { t } = useTranslation("landing");

    return (
        <section aria-labelledby="trust-title" className="py-12 md:py-20">
            <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 sm:px-6 lg:px-8">
                <div className="grid gap-12 md:grid-cols-2">
                    <div className="flex flex-col gap-6">
                        <ShieldIcon
                            aria-hidden="true"
                            className="size-8 text-primary-text"
                        />
                        <h2
                            id="trust-title"
                            className="type-h1 text-foreground"
                        >
                            {t("trust.title")}
                        </h2>
                        <p className="type-body-lg text-muted-foreground">
                            {t("trust.sub")}
                        </p>
                        <Button asChild variant="outline" className="w-fit">
                            <Link to={LANDING_LINKS.privacy}>
                                {t("trust.link")}
                                <ArrowRightIcon aria-hidden="true" />
                            </Link>
                        </Button>
                    </div>
                    <ul className="flex flex-col gap-4">
                        {TRUST_ITEMS.map((item, index) => (
                            <Reveal
                                as="li"
                                key={item.id}
                                delay={
                                    Math.min(index, STAGGER.maxSiblings) *
                                    STAGGER.sibling
                                }
                                className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
                            >
                                {item.badge ? (
                                    <Badge
                                        variant="secondary"
                                        className="w-fit"
                                    >
                                        {t(`trust.badge.${item.badge}`)}
                                    </Badge>
                                ) : null}
                                <p className="type-body text-card-foreground">
                                    {t(`trust.items.${item.id}`)}
                                </p>
                            </Reveal>
                        ))}
                    </ul>
                </div>
                <TrustChain className="rounded-lg border border-border bg-muted p-4 sm:p-6" />
            </div>
        </section>
    );
}
