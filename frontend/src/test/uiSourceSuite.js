import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* Static guards for the design system (UI-01..04, UI-12, UI-13, UI-21, UI-40). `npm run rules:check` enforces the same
   rules repo-wide; these tests fail fast inside the frontend workspace. */

const SRC = path.resolve(import.meta.dirname, "..");
const UI_DIR = path.join(SRC, "components", "ui");
const read = (file) => fs.readFileSync(file, "utf8");
const uiFiles = fs.readdirSync(UI_DIR).filter((name) => name.endsWith(".jsx"));
const css = read(path.join(SRC, "index.css"));

// Patterns are assembled from parts so this guard does not trip the repo-wide checks it mirrors.
const BACKSLASH = String.fromCharCode(92);
const BANNED_EFFECTS = new RegExp(
    [
        "gradient",
        "backdrop-",
        `${BACKSLASH}bblur-`,
        "drop-" + "shadow",
        "text-" + "shadow",
    ].join("|")
);
const BANNED_PLAIN_COLOURS = new RegExp(
    ["bg", "text", "border"]
        .flatMap((p) => ["black", "white"].map((c) => `${p}-${c}`))
        .join("|")
);
const BANNED_CSS_EFFECTS = new RegExp(
    [
        `gradient${BACKSLASH}(`,
        "backdrop-" + "filter",
        `filter:${BACKSLASH}s*` + "blur",
    ].join("|")
);

describe("components/ui source", () => {
    it("contains the shadcn components the app relies on", () => {
        for (const name of [
            "button",
            "input",
            "dialog",
            "sheet",
            "sidebar",
            "sonner",
            "field",
            "table",
            "pagination",
        ]) {
            expect(uiFiles, name).toContain(`${name}.jsx`);
        }
    });

    it.each(uiFiles)(
        "%s imports no lucide-react and no react-icons",
        (file) => {
            const code = read(path.join(UI_DIR, file));
            expect(code).not.toMatch(/lucide/i);
            expect(code).not.toMatch(/from\s+["']react-icons/);
        }
    );

    it.each(uiFiles)(
        "%s has no colour literal, gradient, blur or coloured shadow",
        (file) => {
            const code = read(path.join(UI_DIR, file));
            expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
            expect(code).not.toMatch(/\b(?:rgba?|hsla?|oklch|oklab)\(/);
            expect(code).not.toMatch(BANNED_EFFECTS);
            expect(code).not.toMatch(/shadow-(?:xs|lg|xl|2xl|inner|\[)/);
            expect(code).not.toMatch(BANNED_PLAIN_COLOURS);
        }
    );

    it.each(uiFiles)(
        "%s uses the UI-13 focus ring and no dark: colour utilities",
        (file) => {
            const code = read(path.join(UI_DIR, file));
            expect(code).not.toMatch(/ring-ring\/\d+|ring-\[3px\]|ring-3\b/);
            expect(code).not.toMatch(/dark:(?:bg|text|border|ring)-/);
        }
    );

    it.each(uiFiles)(
        "%s uses only the allowed z-index and radius scale",
        (file) => {
            const code = read(path.join(UI_DIR, file));
            for (const [, z] of code.matchAll(/\bz-(\d+)\b/g)) {
                expect(["30", "40", "50", "100"]).toContain(z);
            }
            expect(code).not.toMatch(/rounded-(?:2xl|3xl|4xl|xl)\b/);
        }
    );
});

describe("index.css", () => {
    const SEMANTIC = [
        "background",
        "foreground",
        "card",
        "card-foreground",
        "popover",
        "popover-foreground",
        "primary",
        "primary-foreground",
        "primary-text",
        "secondary",
        "secondary-foreground",
        "muted",
        "muted-foreground",
        "accent",
        "accent-foreground",
        "destructive",
        "border",
        "input",
        "ring",
        "scrim",
        "chart-1",
        "chart-5",
        "sidebar",
        "sidebar-primary",
        "sidebar-accent-foreground",
        "sidebar-ring",
        ...["success", "warning", "info", "destructive"].flatMap((s) => [
            s,
            `${s}-foreground`,
            `${s}-subtle`,
            `${s}-subtle-foreground`,
            `${s}-border`,
        ]),
    ];
    const light = css.slice(
        css.indexOf("/* Light theme"),
        css.indexOf(".dark {")
    );
    const dark = css.slice(
        css.indexOf(".dark {"),
        css.indexOf("@theme inline")
    );

    it("keeps the charter primary as the 500 step", () => {
        expect(css).toMatch(/--primary-500:\s*oklch\(0\.672 0\.131 38\.8\)/);
    });

    it.each(SEMANTIC)(
        "defines %s in both themes and maps it into Tailwind",
        (token) => {
            expect(light).toMatch(new RegExp(`--${token}:`));
            expect(dark).toMatch(new RegExp(`--${token}:`));
            expect(css).toMatch(
                new RegExp(`--color-${token}:\\s*var\\(--${token}\\)`)
            );
        }
    );

    it("clears the default colour, shadow and radius namespaces", () => {
        expect(css).toContain("--color-*: initial");
        expect(css).toContain("--shadow-*: initial");
        expect(css).toContain("--radius-*: initial");
        expect(css).toContain("--radius: 0.5rem");
    });

    it("declares the type scale as type-* utilities and the three font roles", () => {
        for (const name of [
            "display-xl",
            "display",
            "h1",
            "h2",
            "h3",
            "h4",
            "body-lg",
            "body",
            "small",
            "caption",
            "overline",
            "stat",
            "code",
        ]) {
            expect(css).toContain(`@utility type-${name}`);
        }
        expect(css).not.toMatch(/@utility text-/);
        for (const role of ["display", "sans", "mono"]) {
            expect(css).toMatch(new RegExp(`--font-${role}:`));
        }
    });

    it("has no gradient, blur or backdrop filter", () => {
        expect(css).not.toMatch(BANNED_CSS_EFFECTS);
    });

    it("honours reduced motion and keyboard focus in the base layer", () => {
        expect(css).toContain("prefers-reduced-motion: reduce");
        expect(css).toMatch(
            /:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--ring\)/
        );
    });
});
