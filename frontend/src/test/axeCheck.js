import { configureAxe } from "vitest-axe";
import { expect } from "vitest";

/* Shared axe runner for component smoke tests. jsdom has no layout, so colour contrast is verified
   by the palette contrast table (UI-09) instead; "region" is off because a lone component is not a page. */
export const axeCheck = configureAxe({
    rules: {
        region: { enabled: false },
        "color-contrast": { enabled: false },
    },
});

export async function expectAccessible(element) {
    expect(await axeCheck(element)).toHaveNoViolations();
}
