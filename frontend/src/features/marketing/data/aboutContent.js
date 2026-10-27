/*
 * Non-translatable facts for the About page (docs/23 section 4). Copy lives in the `about` i18n namespace.
 * Everything here is either a proper noun, a figure that exists in the product docs (doc 06, doc 13) or a
 * clearly flagged placeholder. No invented statistics (ANIM-41). The six developers live in `developers.js`.
 */

/** Square brackets mark a value the team still has to supply (docs/23 section 8). */
export const ABOUT_PLACEHOLDERS = Object.freeze({
    llmProvider: "[LLM_PROVIDER: placeholder]",
    mentor: "[MENTOR: placeholder]",
});

/** Stops of the story timeline, in order; titles and text come from `about:story.stops` in this order. */
export const STORY_STOPS = Object.freeze([
    { id: "scattered" },
    { id: "unmeasured" },
    { id: "slow" },
    { id: "blind" },
    { id: "measured" },
]);

/**
 * Build chapters, in order; copy comes from `about:how.chapters` in this order. `status` is set by the team:
 * done, inProgress or planned (same words as the roadmap).
 */
export const BUILD_CHAPTERS = Object.freeze([
    { id: "idea", status: "done" },
    { id: "framework", status: "inProgress" },
    { id: "backend", status: "inProgress" },
    { id: "interface", status: "inProgress" },
    { id: "next", status: "planned" },
]);

/** Proficiency levels 0-5 (doc 06). Names and summaries come from `about:ladder.levels`, in this order. */
export const LADDER_LEVELS = Object.freeze([0, 1, 2, 3, 4, 5]);

/** Product facts shown with COUNT_UP (docs/23 section 1.3: 43 competencies, 4 domains, levels 0 to 5, 10 seed roles). */
export const PRODUCT_FACTS = Object.freeze([
    { id: "domains", value: 4 },
    { id: "competencies", value: 43 },
    { id: "levels", value: 6 },
    { id: "roles", value: 10 },
]);

/**
 * Roadmap phases from doc 13 (weeks from kickoff). `status` is set by the team: done, inProgress or planned.
 * Calendar dates are still to be set.
 */
export const ROADMAP_PHASES = Object.freeze([
    { id: "setup", status: "done" },
    { id: "foundations", status: "inProgress" },
    { id: "coreAi", status: "planned" },
    { id: "loop", status: "planned" },
    { id: "security", status: "planned" },
    { id: "launch", status: "planned" },
]);

/** Technology strip: proper nouns, shown as plain chips (no logos, no endorsement implied). */
export const TECH_STACK = Object.freeze([
    "React",
    "Vite",
    "Redux Toolkit",
    "Tailwind CSS",
    "shadcn/ui",
    "Node.js",
    "Express",
    "MongoDB Atlas",
    "Cloudinary",
    "Brevo",
    "Vercel",
    "Render",
]);

/** Badge variant per roadmap or chapter status (success, info, outline), shared by the roadmap and the build chapters. */
export const STATUS_BADGE_VARIANT = Object.freeze({
    done: "success",
    inProgress: "info",
    planned: "outline",
});
