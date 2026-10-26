import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { anonymousAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { MOTION_TIER_CASES, setMotionTier } from "@/test/motionTier";
import { renderAuthPage } from "@/test/renderAuthPage";

afterEach(async () => {
    await i18n.changeLanguage("en");
    document.documentElement.classList.remove("dark");
});

function renderFrame() {
    return renderAuthPage(
        <main id="main-content" tabIndex={-1}>
            <h1>Page body</h1>
        </main>,
        { path: "/login", preloadedState: { auth: anonymousAuth } }
    );
}

describe("AuthSplitLayout", () => {
    beforeEach(() => setMotionTier("reduced"));

    it("renders the page through the outlet and adds no main landmark of its own", async () => {
        const { container } = renderFrame();
        expect(screen.getAllByRole("main")).toHaveLength(1);
        expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
        expect(
            screen.getByRole("heading", { name: "Page body" })
        ).toBeInTheDocument();
        await expectAccessible(container);
    });

    it("has a flat brand panel with the tagline, one principle and the topics", () => {
        renderFrame();
        const panel = screen.getByRole("complementary", {
            name: "About SAMARTH AI",
        });
        expect(panel.className).toContain("bg-primary");
        expect(panel.className).toContain("hidden");
        expect(panel.className).toContain("lg:flex");
        expect(
            within(panel).getByText(
                "Smart Competency Intelligence for Official Statistics"
            )
        ).toBeInTheDocument();
        expect(
            within(panel).getByText(/backed by evidence and a formula/)
        ).toBeInTheDocument();
        expect(
            within(panel).getByText("Holistic capacity building")
        ).toBeInTheDocument();
        expect(panel.querySelector("[class*=gradient]")).toBeNull();
    });

    it("shows the prototype disclaimer and legal links in the footer", () => {
        renderFrame();
        const footer = screen.getByRole("contentinfo");
        expect(
            within(footer).getByText(
                /Not an official Government of India website/
            )
        ).toBeInTheDocument();
        expect(
            within(footer).getByRole("link", { name: "Terms of Use" })
        ).toHaveAttribute("href", "/terms");
        expect(
            within(footer).getByRole("link", { name: "Privacy Policy" })
        ).toHaveAttribute("href", "/privacy");
    });

    it("keeps language and theme controls compact and labelled in the header", () => {
        renderFrame();
        const group = screen.getByRole("group", {
            name: "Display preferences",
        });
        expect(
            within(group).getByRole("button", { name: "Language" })
        ).toBeInTheDocument();
        expect(
            within(group).getByRole("button", { name: "Theme" })
        ).toBeInTheDocument();
    });

    it("switches the language to Hindi from the header menu", async () => {
        const user = userEvent.setup();
        renderFrame();
        await user.click(screen.getByRole("button", { name: "Language" }));
        await user.click(
            await screen.findByRole("menuitemradio", { name: "हिन्दी" })
        );
        expect(
            await screen.findByRole("group", { name: "प्रदर्शन वरीयताएँ" })
        ).toBeInTheDocument();
        expect(document.documentElement.lang).toBe("hi");
    });

    it.each(MOTION_TIER_CASES)(
        "renders all content on the %s motion tier",
        (tier) => {
            setMotionTier(tier);
            renderFrame();
            expect(screen.getByText("Page body")).toBeInTheDocument();
            expect(
                screen.getAllByText("Skill assessment").length
            ).toBeGreaterThan(0);
            expect(
                screen.getByText(/backed by evidence and a formula/)
            ).toBeInTheDocument();
        }
    );
});
