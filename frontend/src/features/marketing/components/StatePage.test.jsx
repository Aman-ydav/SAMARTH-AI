import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { HomeIcon } from "@/components/icons";
import { StatePage } from "@/features/marketing/components/StatePage";
import { i18n } from "@/i18n";
import { expectAccessible } from "@/test/axeCheck";

function renderState(props) {
    return render(
        <I18nextProvider i18n={i18n}>
            <MemoryRouter>
                <StatePage icon={HomeIcon} title="A title" {...props} />
            </MemoryRouter>
        </I18nextProvider>
    );
}

describe("StatePage", () => {
    it("renders a main landmark, one focused h1 and a decorative icon", async () => {
        const { container } = renderState({ body: "Explanation" });
        const heading = screen.getByRole("heading", { level: 1 });
        expect(heading).toHaveTextContent("A title");
        expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
        expect(screen.getByText("Explanation")).toBeInTheDocument();
        expect(container.querySelector("svg")).toHaveAttribute(
            "aria-hidden",
            "true"
        );
        await waitFor(() => expect(heading).toHaveFocus());
        await expectAccessible(container);
    });

    it("sets the document title from the page title", () => {
        renderState({});
        expect(document.title).toBe("A title | SAMARTH AI");
    });

    it("renders router links and buttons as actions and runs onClick", async () => {
        const onClick = vi.fn();
        renderState({
            primary: { label: "Go", to: "/somewhere" },
            secondary: { label: "Act", onClick },
        });
        expect(screen.getByRole("link", { name: "Go" })).toHaveAttribute(
            "href",
            "/somewhere"
        );
        await userEvent.click(screen.getByRole("button", { name: "Act" }));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("disables an action while it is working", () => {
        renderState({
            primary: { label: "Busy", onClick: vi.fn(), disabled: true },
        });
        expect(screen.getByRole("button", { name: "Busy" })).toBeDisabled();
    });

    it("renders children between the explanation and the actions", () => {
        renderState({ children: <p>extra status</p> });
        expect(screen.getByText("extra status")).toBeInTheDocument();
    });
});
