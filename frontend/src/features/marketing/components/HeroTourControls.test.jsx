import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { HeroTourControls } from "@/features/marketing/components/HeroTourControls";
import { expectAccessible } from "@/test/axeCheck";
import { renderWithProviders } from "@/test/renderWithProviders";

function renderControls(props) {
    const handlers = { onToggle: vi.fn(), onGoTo: vi.fn() };
    const result = renderWithProviders(
        <HeroTourControls
            step={0}
            playing
            showPlayback
            {...handlers}
            {...props}
        />
    );
    return { ...result, ...handlers };
}

describe("HeroTourControls", () => {
    afterEach(async () => {
        await act(() => i18n.changeLanguage("en"));
    });

    it("shows the step label and the story text of the current step", () => {
        renderControls({ step: 1 });
        expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
        expect(screen.getByText("Gaps are found")).toBeInTheDocument();
        expect(
            screen.getByText(
                "Levels are compared with what the role needs and ranked."
            )
        ).toBeInTheDocument();
    });

    it("offers four labelled step buttons and marks the current one", () => {
        renderControls({ step: 2 });
        const group = screen.getByRole("group", { name: "Product tour" });
        const buttons = within(group).getAllByRole("button", {
            name: /^Show step/,
        });
        expect(buttons).toHaveLength(4);
        expect(buttons[2]).toHaveAttribute("aria-current", "step");
        expect(buttons[0]).not.toHaveAttribute("aria-current");
        expect(buttons[3]).toHaveAccessibleName(
            "Show step 4: Evidence updates a level"
        );
    });

    it("calls back when a step is chosen and when playback is toggled", () => {
        const { onGoTo, onToggle } = renderControls();
        fireEvent.click(screen.getByRole("button", { name: /Show step 3/ }));
        expect(onGoTo).toHaveBeenCalledWith(2);
        fireEvent.click(
            screen.getByRole("button", { name: "Pause the product tour" })
        );
        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("switches the button to play when paused and hides it when nothing autoplays", () => {
        const paused = renderControls({ playing: false });
        expect(
            screen.getByRole("button", { name: "Play the product tour" })
        ).toBeInTheDocument();
        paused.unmount();
        renderControls({ showPlayback: false });
        expect(
            screen.queryByRole("button", { name: /product tour/ })
        ).toBeNull();
    });

    it("reserves room for the label so the layout does not shift between steps", () => {
        const { container } = renderControls();
        expect(container.querySelector(".min-h-24")).not.toBeNull();
    });

    it("renders in Hindi", async () => {
        await act(() => i18n.changeLanguage("hi"));
        renderControls();
        expect(screen.getByText("चरण 1 / 4")).toBeInTheDocument();
        expect(
            screen.getByText("आपकी प्रोफ़ाइल का अनुमान लगता है")
        ).toBeInTheDocument();
    });

    it("has no axe violations", async () => {
        const { container } = renderControls();
        await expectAccessible(container);
    });
});
