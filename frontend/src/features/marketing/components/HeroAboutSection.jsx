import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { ParallaxLayer } from "@/components/motion/ParallaxLayer";
import { Reveal } from "@/components/motion/Reveal";
import { TextReveal } from "@/components/motion/TextReveal";

/* Flat statistics skyline: three layers of bars (heights in viewBox units) at different parallax speeds. */
const SKYLINE = [
    {
        id: "far",
        distance: 24,
        fill: "fill-muted",
        bars: [64, 96, 80, 112, 80, 96, 64, 112],
    },
    {
        id: "mid",
        distance: 48,
        fill: "fill-accent",
        bars: [48, 80, 64, 96, 48, 80, 96, 64],
    },
    {
        id: "near",
        distance: 72,
        fill: "fill-secondary",
        bars: [32, 48, 64, 40, 56, 32, 64, 48],
    },
];

const BAR_WIDTH = 10;
const BAR_STEP = 12;
const VIEW_HEIGHT = 112;

function SkylineLayer({ layer }) {
    return (
        <ParallaxLayer
            distance={layer.distance}
            className="absolute inset-x-0 bottom-0"
        >
            <svg
                viewBox="0 0 96 112"
                preserveAspectRatio="none"
                className="block h-32 w-full"
                focusable="false"
            >
                {layer.bars.map((height, index) => (
                    <rect
                        key={`${layer.id}-${index * BAR_STEP}`}
                        x={index * BAR_STEP}
                        y={VIEW_HEIGHT - height}
                        width={BAR_WIDTH}
                        height={height}
                        className={layer.fill}
                    />
                ))}
            </svg>
        </ParallaxLayer>
    );
}

/** About hero (ANIM-51, first): load-mode headline reveal, sub-headline, and a flat three-layer skyline. */
export function HeroAboutSection() {
    const { t } = useTranslation("about");
    return (
        <section
            aria-labelledby="about-hero-title"
            className="relative overflow-clip border-b border-border"
        >
            <div className="mx-auto w-full max-w-7xl px-4 pt-16 pb-40 sm:px-6 md:pt-24 md:pb-48 lg:px-8">
                <Badge variant="outline">{t("hero.chip")}</Badge>
                <p className="type-overline mt-6 text-primary-text">
                    {t("hero.overline")}
                </p>
                <h1 id="about-hero-title" className="mt-3 max-w-4xl">
                    <TextReveal
                        as="span"
                        mode="load"
                        text={t("hero.title")}
                        className="type-display block text-balance"
                    />
                </h1>
                <Reveal>
                    <p className="type-body-lg mt-6 max-w-2xl text-muted-foreground">
                        {t("hero.sub")}
                    </p>
                </Reveal>
            </div>
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
            >
                {SKYLINE.map((layer) => (
                    <SkylineLayer key={layer.id} layer={layer} />
                ))}
            </div>
        </section>
    );
}
