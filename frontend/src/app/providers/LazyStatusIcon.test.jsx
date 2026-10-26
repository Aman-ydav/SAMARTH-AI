import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { BootSplash } from "@/app/providers/BootSplash";
import { LazyStatusIcon } from "@/app/providers/LazyStatusIcon";
import { i18n } from "@/i18n";

describe("LazyStatusIcon", () => {
    it("reserves its box first and then swaps in the registry glyph", async () => {
        const { container } = render(
            <LazyStatusIcon name="wifiOff" className="size-4" />
        );
        expect(container.querySelector("span.size-4")).toBeInTheDocument();
        await expect
            .poll(() => container.querySelector("svg.size-4"))
            .not.toBeNull();
        expect(container.querySelector("svg")).toHaveAttribute(
            "aria-hidden",
            "true"
        );
    });
});

describe("BootSplash", () => {
    it("announces loading without drawing an icon-registry glyph", () => {
        const { container } = render(
            <I18nextProvider i18n={i18n}>
                <BootSplash />
            </I18nextProvider>
        );
        expect(screen.getByRole("status", { name: /loading/i })).toBeVisible();
        expect(container.querySelector("svg")).toBeNull();
    });
});
