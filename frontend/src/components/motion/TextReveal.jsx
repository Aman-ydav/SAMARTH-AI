import { createElement, Fragment, useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useMotionTier } from "@/hooks/useMotionTier";
import { DURATION, EASE, STAGGER } from "@/lib/motionTokens";

const WORD_GAP = /\s+/;
const DIM_OPACITY = 0.25;
const MAX_LOAD_SECONDS = 0.7;

function toWords(text) {
    return text.trim().split(WORD_GAP).filter(Boolean);
}

function LitWord({ word, progress, from, to }) {
    const opacity = useTransform(progress, [from, to], [DIM_OPACITY, 1]);
    return <motion.span style={{ opacity }}>{word}</motion.span>;
}

function ScrollWords({ as: Tag, text, words, className }) {
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start 0.85", "end 0.45"],
    });
    const count = words.length;
    return (
        <Tag ref={ref} className={className}>
            <span className="sr-only">{text}</span>
            <span aria-hidden="true">
                {words.map((word, index) => (
                    <Fragment key={`${index}-${word}`}>
                        <LitWord
                            word={word}
                            progress={scrollYProgress}
                            from={index / count}
                            to={(index + 1) / count}
                        />
                        {index < count - 1 ? " " : null}
                    </Fragment>
                ))}
            </span>
        </Tag>
    );
}

function LoadWords({ as: Tag, text, words, className }) {
    const count = words.length;
    const step =
        count > 1
            ? Math.min(
                  STAGGER.word,
                  (MAX_LOAD_SECONDS - DURATION.base) / (count - 1)
              )
            : 0;
    return (
        <Tag className={className}>
            <span className="sr-only">{text}</span>
            <span aria-hidden="true">
                {words.map((word, index) => (
                    <Fragment key={`${index}-${word}`}>
                        <span className="-mb-[0.15em] inline-block overflow-clip pb-[0.15em] align-bottom">
                            <motion.span
                                className="inline-block"
                                initial={{ y: "100%" }}
                                animate={{ y: 0 }}
                                transition={{
                                    duration: DURATION.base,
                                    ease: EASE.out,
                                    delay: index * step,
                                }}
                            >
                                {word}
                            </motion.span>
                        </span>
                        {index < count - 1 ? " " : null}
                    </Fragment>
                ))}
            </span>
        </Tag>
    );
}

/**
 * Word-by-word headline or statement (ANIM-30). Splits by words, never characters, keeps the full text in an
 * `sr-only` copy and hides the animated copy from assistive tech. `mode="load"` slides masked words up on mount
 * (no opacity start, LCP safe, 700 ms at most); `mode="scroll"` lights words as the block scrolls through.
 * Keep it at 60 words or fewer. Static text on lite and reduced tiers.
 */
export function TextReveal({ text, as = "p", mode = "scroll", className }) {
    const tier = useMotionTier();
    const words = toWords(text ?? "");
    if (tier !== "full" || words.length === 0) {
        return createElement(as, { className }, text);
    }
    const Variant = mode === "load" ? LoadWords : ScrollWords;
    return <Variant as={as} text={text} words={words} className={className} />;
}
