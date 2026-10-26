/** Shared easing, duration, stagger and spring numbers for every animation (ANIM-07). */

export const EASE = Object.freeze({
    out: [0.22, 1, 0.36, 1],
    inOut: [0.65, 0, 0.35, 1],
    linear: "linear",
});

export const DURATION = Object.freeze({
    fast: 0.2,
    base: 0.45,
    reveal: 0.6,
    load: 0.7,
    count: 1.4,
});

export const STAGGER = Object.freeze({
    word: 0.05,
    sibling: 0.08,
    maxSiblings: 6,
});

export const SPRING = Object.freeze({
    progress: Object.freeze({ stiffness: 120, damping: 30, restDelta: 0.001 }),
    velocity: Object.freeze({ stiffness: 80, damping: 30 }),
});

/** Distance in px of the reveal-on-view rise (ANIM table, REVEAL_ON_VIEW). */
export const REVEAL_OFFSET = 16;

/** Largest allowed tilt for TILT_3D in degrees (ANIM-33). */
export const TILT_MAX_DEG = 35;

/** Largest total parallax travel in px (ANIM-36). */
export const PARALLAX_MAX_PX = 120;
