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

/** Hero laptop (ANIM-64): lid opening, screen turn-on and the small scroll tilt. Angles in degrees, times in seconds. */
export const LAPTOP = Object.freeze({
    screenWidth: 1120,
    screenHeight: 700,
    closedDeg: -84,
    perspective: 1400,
    riseY: 24,
    openDelay: 0.3,
    openDuration: 1.1,
    screenDelay: 1.25,
    screenDuration: 0.5,
    scrollTiltDeg: 10,
    scrollTravelPx: 32,
});

/** Time one hero tour step stays on screen (ANIM-64: 4 to 6 seconds). */
export const TOUR_STEP_MS = 5000;

/** Scroll phases of the measure meters (ANIM-47): row i fills from fillFrom + i * fillStep over fillSpan, then the gap lights between gapFrom and gapTo. */
export const METERS = Object.freeze({
    fillFrom: 0.04,
    fillStep: 0.04,
    fillSpan: 0.36,
    gapFrom: 0.72,
    gapTo: 0.88,
    seenAt: 0.02,
});
