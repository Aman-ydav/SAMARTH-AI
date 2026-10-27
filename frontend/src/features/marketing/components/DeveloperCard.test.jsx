import { render, screen, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it } from "vitest";
import { DeveloperCard } from "@/features/marketing/components/DeveloperCard";
import { DEVELOPERS } from "@/features/marketing/data/developers";
import { i18n, loadAllNamespaces } from "@/i18n";
import { expectAccessible } from "@/test/axeCheck";

await loadAllNamespaces();

const filled = {
    ...DEVELOPERS[0],
    name: "Test Person",
    placeholder: false,
    role: { en: "Built the API", hi: "API बनाया" },
    note: { en: "Likes small functions.", hi: "छोटे फ़ंक्शन पसंद हैं।" },
    github: "https://github.com/example-person",
    linkedin: "https://www.linkedin.com/in/example-person",
};

const renderCard = (developer) =>
    render(
        <I18nextProvider i18n={i18n}>
            <DeveloperCard developer={developer} />
        </I18nextProvider>
    );

describe("DeveloperCard", () => {
    afterEach(async () => {
        await i18n.changeLanguage("en");
    });

    it("marks a placeholder entry with the badge and initials, without links", () => {
        const { container } = renderCard(DEVELOPERS[2]);
        const card = container.querySelector("[data-developer]");
        expect(card).toHaveAttribute("data-developer-placeholder", "true");
        expect(within(card).getByText("Placeholder")).toBeInTheDocument();
        expect(
            within(card).getByRole("heading", { level: 3, name: "Developer 3" })
        ).toBeInTheDocument();
        expect(card).toHaveTextContent("D3");
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("shows a filled entry without the placeholder badge and with both links opening safely", () => {
        const { container } = renderCard(filled);
        const card = container.querySelector("[data-developer]");
        expect(card).not.toHaveAttribute("data-developer-placeholder");
        expect(within(card).queryByText("Placeholder")).not.toBeInTheDocument();
        expect(screen.getByText("Built the API")).toBeInTheDocument();
        expect(screen.getByText("Likes small functions.")).toBeInTheDocument();
        const github = screen.getByRole("link", {
            name: /Test Person on GitHub/,
        });
        expect(github).toHaveAttribute(
            "href",
            "https://github.com/example-person"
        );
        expect(github).toHaveAttribute("target", "_blank");
        expect(github).toHaveAttribute("rel", "noopener noreferrer");
        const linkedin = screen.getByRole("link", {
            name: /Test Person on LinkedIn/,
        });
        expect(linkedin).toHaveAttribute("rel", "noopener noreferrer");
        expect(
            screen.getByRole("list", { name: "Links for Test Person" })
        ).toBeInTheDocument();
    });

    it("renders a link only for the value that is filled", () => {
        renderCard({ ...filled, linkedin: "" });
        expect(
            screen.getByRole("link", { name: /on GitHub/ })
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("link", { name: /on LinkedIn/ })
        ).not.toBeInTheDocument();
    });

    it("drops values that are not https URLs", () => {
        renderCard({
            ...filled,
            github: "javascript:alert(1)",
            linkedin: "http://insecure.example/in/x",
        });
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
        expect(
            screen.queryByRole("list", { name: /Links/ })
        ).not.toBeInTheDocument();
    });

    it("picks the Hindi role and note", async () => {
        await i18n.changeLanguage("hi");
        renderCard(filled);
        expect(screen.getByText("API बनाया")).toBeInTheDocument();
        expect(screen.getByText("छोटे फ़ंक्शन पसंद हैं।")).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: /GitHub पर Test Person/ })
        ).toBeInTheDocument();
    });

    it("survives missing optional text", () => {
        renderCard({
            ...filled,
            role: "",
            note: undefined,
            github: "",
            linkedin: "",
        });
        expect(
            screen.getByRole("heading", { level: 3, name: "Test Person" })
        ).toBeInTheDocument();
    });

    it("has no axe violations with and without links", async () => {
        const first = renderCard(filled);
        await expectAccessible(first.container);
        first.unmount();
        const second = renderCard(DEVELOPERS[0]);
        await expectAccessible(second.container);
    });
});
