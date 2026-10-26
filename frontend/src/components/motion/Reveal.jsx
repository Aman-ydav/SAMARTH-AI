import { createElement } from "react";
import { motion } from "motion/react";
import { useMotionTier } from "@/hooks/useMotionTier";
import { cn } from "@/lib/utils";
import { DURATION, EASE, REVEAL_OFFSET } from "@/lib/motionTokens";

/**
 * Fade plus 16 px rise, once, when the block enters the viewport (ANIM-42). Static under reduced motion.
 * Use at most 40 per page and stagger at most 6 siblings with `delay`.
 */
export function Reveal({
    children,
    delay = 0,
    as = "div",
    className,
    ...rest
}) {
    const tier = useMotionTier();
    if (tier === "reduced") {
        return createElement(as, { className, ...rest }, children);
    }
    const MotionTag = motion[as];
    return (
        <MotionTag
            className={cn(className)}
            initial={{ opacity: 0, y: REVEAL_OFFSET }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -10% 0px" }}
            transition={{ duration: DURATION.reveal, ease: EASE.out, delay }}
            {...rest}
        >
            {children}
        </MotionTag>
    );
}
