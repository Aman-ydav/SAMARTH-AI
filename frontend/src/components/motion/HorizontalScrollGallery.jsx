import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useScroll, useTransform } from "motion/react";
import { useMotionTier } from "@/hooks/useMotionTier";
import { cn } from "@/lib/utils";

const EDGE_PADDING_PX = 16;

function PinnedGallery({ items, renderItem, header, label, className }) {
    const trackRef = useRef(null);
    const stageRef = useRef(null);
    const stripRef = useRef(null);
    const [travel, setTravel] = useState(0);
    const travelValue = useMotionValue(0);
    const { scrollYProgress } = useScroll({
        target: trackRef,
        offset: ["start start", "end end"],
    });
    const x = useTransform(
        [scrollYProgress, travelValue],
        ([progress, distance]) => -progress * distance
    );

    useEffect(() => {
        const stage = stageRef.current;
        const strip = stripRef.current;
        if (!stage || !strip) return undefined;
        const measure = () => {
            const distance = Math.max(0, strip.scrollWidth - stage.clientWidth);
            travelValue.set(distance);
            setTravel(distance);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(stage);
        observer.observe(strip);
        return () => observer.disconnect();
    }, [travelValue, items]);

    const handleFocus = (event) => {
        const card = event.target.closest("[data-gallery-card]");
        const track = trackRef.current;
        if (!card || !track) return;
        const wanted = Math.min(
            travel,
            Math.max(0, card.offsetLeft - EDGE_PADDING_PX)
        );
        const trackTop = track.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: trackTop + wanted });
    };

    return (
        <div
            ref={trackRef}
            style={{ "--gallery-travel": `${travel}px` }}
            className={cn(
                "relative h-[calc(100svh+var(--gallery-travel))]",
                className
            )}
        >
            <div
                ref={stageRef}
                className="sticky top-0 flex h-svh flex-col justify-center gap-8 overflow-clip"
            >
                {header}
                <motion.ul
                    ref={stripRef}
                    aria-label={label}
                    className="relative flex w-max gap-6 px-4 will-change-transform sm:px-6 lg:px-8"
                    style={{ x }}
                    onFocusCapture={handleFocus}
                >
                    {items.map((item, index) => (
                        <li
                            key={item.id}
                            data-gallery-card=""
                            className="w-80 shrink-0"
                        >
                            {renderItem(item, index)}
                        </li>
                    ))}
                </motion.ul>
            </div>
        </div>
    );
}

function NativeGallery({ items, renderItem, header, label, className }) {
    return (
        <div className={cn("flex flex-col gap-8 py-12 md:py-20", className)}>
            {header}
            <div
                role="region"
                aria-label={label}
                tabIndex={0}
                className="overflow-x-auto rounded-lg pb-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
                <ul className="flex w-max snap-x snap-proximity gap-4 px-4 sm:px-6">
                    {items.map((item, index) => (
                        <li
                            key={item.id}
                            className="w-72 shrink-0 snap-start sm:w-80"
                        >
                            {renderItem(item, index)}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

/**
 * Vertical scroll moves a card strip sideways inside a pinned stage (ANIM-39). `items` is `[{ id, ... }]`,
 * `renderItem(item, index)` renders a card (20rem wide), `header` is pinned above the strip and `label` names
 * the strip for assistive tech. The scroll distance is the measured overflow (ResizeObserver) and focusing a
 * card scrolls the page to it. Lite and reduced tiers use a native `overflow-x-auto` snap strip.
 */
export function HorizontalScrollGallery({
    items,
    renderItem,
    header,
    label,
    className,
}) {
    const tier = useMotionTier();
    if (!items?.length) return null;
    const Gallery = tier === "full" ? PinnedGallery : NativeGallery;
    return (
        <Gallery
            items={items}
            renderItem={renderItem}
            header={header}
            label={label}
            className={className}
        />
    );
}
