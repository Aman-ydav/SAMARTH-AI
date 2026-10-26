import { useEffect, useRef, useState } from "react";
import {
    motion,
    useAnimationFrame,
    useInView,
    useMotionValue,
    useScroll,
    useSpring,
    useVelocity,
    wrap,
} from "motion/react";
import { PauseIcon, PlayIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMotionTier } from "@/hooks/useMotionTier";
import { SPRING } from "@/lib/motionTokens";
import { cn } from "@/lib/utils";

const BOOST_DIVISOR = 500;
const MIN_FACTOR = -4;
const MAX_FACTOR = 5;

function Chip({ children }) {
    return (
        <Badge variant="outline" className="h-8 bg-card px-3 text-sm">
            {children}
        </Badge>
    );
}

function Chips({ items, hidden }) {
    return (
        <ul
            aria-hidden={hidden ? "true" : undefined}
            className="flex shrink-0 gap-2 pr-2"
        >
            {items.map((item) => (
                <li key={item}>
                    <Chip>{item}</Chip>
                </li>
            ))}
        </ul>
    );
}

function TickerDriver({ x, widthRef, speed, boost }) {
    const { scrollY } = useScroll();
    const velocity = useVelocity(scrollY);
    const smooth = useSpring(velocity, SPRING.velocity);
    useAnimationFrame((_time, delta) => {
        const width = widthRef.current;
        if (!width) return;
        const factor = boost
            ? Math.min(
                  MAX_FACTOR,
                  Math.max(MIN_FACTOR, 1 + smooth.get() / BOOST_DIVISOR)
              )
            : 1;
        x.set(wrap(-width, 0, x.get() - speed * factor * (delta / 1000)));
    });
    return null;
}

function MovingTicker({
    items,
    speed,
    ariaLabel,
    className,
    pauseLabel,
    playLabel,
    boost,
}) {
    const regionRef = useRef(null);
    const copyRef = useRef(null);
    const widthRef = useRef(0);
    const x = useMotionValue(0);
    const inView = useInView(regionRef);
    const [engaged, setEngaged] = useState(false);
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        const copy = copyRef.current;
        if (!copy) return undefined;
        const measure = () => {
            widthRef.current = copy.offsetWidth;
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(copy);
        return () => observer.disconnect();
    }, [items]);

    const running = inView && !paused && !engaged;

    return (
        <div
            role="group"
            aria-label={ariaLabel}
            className={cn("flex items-center gap-3", className)}
        >
            <div
                ref={regionRef}
                className="min-w-0 flex-1 overflow-clip"
                onMouseEnter={() => setEngaged(true)}
                onMouseLeave={() => setEngaged(false)}
                onFocusCapture={() => setEngaged(true)}
                onBlurCapture={() => setEngaged(false)}
            >
                <motion.div style={{ x }} className="flex w-max">
                    <div ref={copyRef} className="flex">
                        <Chips items={items} />
                    </div>
                    <Chips items={items} hidden />
                </motion.div>
                {running ? (
                    <TickerDriver
                        x={x}
                        widthRef={widthRef}
                        speed={speed}
                        boost={boost}
                    />
                ) : null}
            </div>
            {pauseLabel && playLabel ? (
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={paused ? playLabel : pauseLabel}
                    aria-pressed={paused}
                    onClick={() => setPaused((value) => !value)}
                >
                    {paused ? (
                        <PlayIcon aria-hidden="true" />
                    ) : (
                        <PauseIcon aria-hidden="true" />
                    )}
                </Button>
            ) : null}
        </div>
    );
}

/**
 * Text-chip marquee (ANIM-35). Two copies (the second `aria-hidden`), moves only while in view, pauses on
 * hover or focus, and offers a visible pause button when `pauseLabel` and `playLabel` are passed (required on
 * Landing, WCAG 2.2.2). `speed` is px per second. Scroll-velocity boost only on the `full` tier and only when
 * `boost` is true (auth pages pass `boost={false}`, ANIM-54); `lite` is a plain ticker; under reduced motion it
 * is a static wrapped list.
 */
export function TickerMarquee({
    items,
    speed = 40,
    ariaLabel,
    className,
    pauseLabel,
    playLabel,
    boost = true,
}) {
    const tier = useMotionTier();
    if (!items?.length) return null;
    if (tier === "reduced") {
        return (
            <ul
                aria-label={ariaLabel}
                className={cn("flex flex-wrap gap-2", className)}
            >
                {items.map((item) => (
                    <li key={item}>
                        <Chip>{item}</Chip>
                    </li>
                ))}
            </ul>
        );
    }
    return (
        <MovingTicker
            items={items}
            speed={speed}
            ariaLabel={ariaLabel}
            className={className}
            pauseLabel={pauseLabel}
            playLabel={playLabel}
            boost={boost && tier === "full"}
        />
    );
}
