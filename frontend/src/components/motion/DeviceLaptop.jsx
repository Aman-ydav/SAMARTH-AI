import { useEffect, useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { Reveal } from "@/components/motion/Reveal";
import { useFitScale } from "@/hooks/useFitScale";
import { useMotionTier } from "@/hooks/useMotionTier";
import { EASE, LAPTOP } from "@/lib/motionTokens";

/*
 * Generic thin laptop drawn with divs and token borders: aluminium lid, thin bezel, camera dot, hinge and a base
 * with a finger lip. No logo, wordmark or shadow. `Lid` and `Screen` are `div` or `motion.div`.
 */
function Frame({
    Lid = "div",
    lidProps,
    Screen = "div",
    screenProps,
    children,
}) {
    const fitRef = useFitScale(LAPTOP.screenWidth);
    return (
        <div className="relative w-full" data-slot="device-laptop">
            <Lid
                {...lidProps}
                className="mx-1.5 origin-bottom rounded-t-xl border border-b-0 border-device-lid-edge bg-device-lid p-1"
            >
                <div className="rounded-t-lg bg-device-bezel px-2 pt-1.5 pb-2">
                    <span
                        aria-hidden="true"
                        className="mx-auto mb-1 block size-1 rounded-full bg-device-lip"
                    />
                    <div
                        ref={fitRef}
                        className="relative aspect-16/10 overflow-clip rounded-sm bg-device-screen-off [--fit-scale:0.5]"
                    >
                        <Screen
                            {...screenProps}
                            className="absolute top-0 left-0 h-175 w-280 origin-top-left scale-(--fit-scale)"
                        >
                            {children}
                        </Screen>
                    </div>
                </div>
            </Lid>
            <div aria-hidden="true" className="h-0.5 bg-device-hinge" />
            <div
                aria-hidden="true"
                className="flex h-3 justify-center rounded-b-xl border border-t-0 border-device-lid-edge bg-device-base"
            >
                <span className="h-1 w-1/5 rounded-b-md bg-device-lip" />
            </div>
        </div>
    );
}

function AnimatedLaptop({ children, onScreenOn }) {
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start 20%", "end start"],
    });
    const rotateX = useTransform(
        scrollYProgress,
        [0, 1],
        [0, LAPTOP.scrollTiltDeg]
    );
    const y = useTransform(scrollYProgress, [0, 1], [0, LAPTOP.scrollTravelPx]);
    const open = {
        duration: LAPTOP.openDuration,
        delay: LAPTOP.openDelay,
        ease: EASE.out,
    };

    return (
        <motion.div
            ref={ref}
            data-state="animated"
            className="origin-bottom"
            style={{ rotateX, y, transformPerspective: LAPTOP.perspective }}
        >
            <motion.div
                initial={{ y: LAPTOP.riseY, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={open}
            >
                <Frame
                    Lid={motion.div}
                    lidProps={{
                        initial: {
                            rotateX: LAPTOP.closedDeg,
                            transformPerspective: LAPTOP.perspective,
                        },
                        animate: { rotateX: 0 },
                        transition: open,
                    }}
                    Screen={motion.div}
                    screenProps={{
                        initial: { opacity: 0 },
                        animate: { opacity: 1 },
                        transition: {
                            duration: LAPTOP.screenDuration,
                            delay: LAPTOP.screenDelay,
                            ease: EASE.out,
                        },
                        onAnimationComplete: onScreenOn,
                    }}
                >
                    {children}
                </Frame>
            </motion.div>
        </motion.div>
    );
}

function OpenLaptop({ children, onScreenOn }) {
    useEffect(() => {
        onScreenOn?.();
    }, [onScreenOn]);
    return (
        <Reveal data-state="open">
            <Frame>{children}</Frame>
        </Reveal>
    );
}

/**
 * Laptop for the hero (DEVICE_LAPTOP, ANIM-64). On the `full` tier the lid opens from closed and flat (`rotateX`),
 * the laptop rises (`y`), the screen turns on (`opacity`) and `onScreenOn` fires; scrolling adds a small tilt and
 * travel. On `lite` it fades in once, on `reduced` it is simply open; both call `onScreenOn` at once. `children` is the
 * screen content, designed for `LAPTOP.screenWidth` by `LAPTOP.screenHeight` (lib/motionTokens.js) and scaled to the frame width. Decorative: the caller sets
 * `aria-hidden` and `inert`.
 */
export function DeviceLaptop({ children, onScreenOn }) {
    const tier = useMotionTier();
    const Laptop = tier === "full" ? AnimatedLaptop : OpenLaptop;
    return <Laptop onScreenOn={onScreenOn}>{children}</Laptop>;
}
