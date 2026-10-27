import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import DashboardPage from "@/features/dashboard/pages/DashboardPage";
import { i18n } from "@/i18n";
import { signedInAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { renderWithProviders } from "@/test/renderWithProviders";

const render = (userOverrides = {}) =>
    renderWithProviders(<DashboardPage />, {
        preloadedState: { auth: signedInAuth(userOverrides) },
    });

describe("DashboardPage", () => {
    afterEach(() => i18n.changeLanguage("en"));

    it("welcomes the person by name with their role in words and exactly one h1", () => {
        render({ name: "Asha Verma", role: "learner" });
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "Welcome, Asha Verma",
            })
        ).toBeInTheDocument();
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
        expect(screen.getByText("Learner")).toBeInTheDocument();
    });

    it("falls back to the email name, then to a plain welcome", () => {
        const { unmount } = render({
            name: "",
            email: "meera.rao@example.test",
        });
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "Welcome, meera.rao",
            })
        ).toBeInTheDocument();
        unmount();
        render({ name: "", email: "" });
        expect(
            screen.getByRole("heading", { level: 1, name: "Welcome" })
        ).toBeInTheDocument();
    });

    it("suggests the learner's next areas, marked as coming soon, with real links", () => {
        render({ role: "learner" });
        const section = screen.getByRole("region", { name: "What comes next" });
        const cards = within(section).getAllByRole("heading", { level: 3 });
        expect(cards.map((card) => card.textContent)).toEqual([
            "My competencies",
            "Skill gaps",
            "Recommendations",
            "Learning path",
        ]);
        expect(within(section).getAllByText("Coming soon")).toHaveLength(4);
        expect(
            within(section).getByRole("link", { name: "Open Skill gaps" })
        ).toHaveAttribute("href", "/gaps");
    });

    it.each([
        ["trainer", ["Content library", "Generate quiz", "Review questions"]],
        ["admin", ["Users", "Team invitations", "Audit log"]],
        [
            "superadmin",
            [
                "Users",
                "Team invitations",
                "Organisations",
                "Competency framework",
                "System settings",
            ],
        ],
    ])("suggests role-appropriate areas for a %s", (role, titles) => {
        render({ role });
        const section = screen.getByRole("region", { name: "What comes next" });
        expect(
            within(section)
                .getAllByRole("heading", { level: 3 })
                .map((card) => card.textContent)
        ).toEqual(titles);
    });

    it.each(["admin", "superadmin"])(
        "points a %s at the built Users and Team invitations screens, not at placeholders",
        (role) => {
            render({ role });
            const section = screen.getByRole("region", {
                name: "What comes next",
            });
            expect(
                within(section).getByRole("link", { name: "Open Users" })
            ).toHaveAttribute("href", "/admin/users");
            expect(
                within(section).getByRole("link", {
                    name: "Open Team invitations",
                })
            ).toHaveAttribute("href", "/admin/invites");
            const cards = within(section)
                .getAllByRole("heading", { level: 3 })
                .map((heading) => heading.closest("[data-slot=card]"));
            const [users, invites] = cards;
            expect(within(users).queryByText("Coming soon")).toBeNull();
            expect(within(invites).queryByText("Coming soon")).toBeNull();
            expect(
                screen.getByText(/Invite trainers/, { selector: "p" })
            ).toBeInTheDocument();
        }
    );

    it("never links a learner to administrative areas", () => {
        const { container } = render({ role: "learner" });
        const hrefs = [...container.querySelectorAll("a")].map((a) =>
            a.getAttribute("href")
        );
        expect(
            hrefs.some((href) => /^\/(admin|superadmin|trainer)/.test(href))
        ).toBe(false);
    });

    it("shows an honest empty overview and no figures anywhere", () => {
        const { container } = render();
        const overview = screen.getByRole("region", { name: "Your overview" });
        expect(
            within(overview).getByText("Nothing to show yet")
        ).toBeInTheDocument();
        expect(
            within(overview).getByRole("link", {
                name: "Open profile settings",
            })
        ).toHaveAttribute("href", "/settings/profile");
        expect(container.textContent).not.toMatch(/\d/);
    });

    it("has an ordered heading outline", () => {
        render();
        const levels = screen
            .getAllByRole("heading")
            .map((heading) => Number(heading.tagName.slice(1)));
        expect(levels[0]).toBe(1);
        for (let i = 1; i < levels.length; i += 1)
            expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    });

    it("renders no suggestions for an unknown role but still welcomes the person", () => {
        render({ role: "wizard" });
        expect(
            screen.queryByRole("region", { name: "What comes next" })
        ).not.toBeInTheDocument();
        expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    it("is translated into Hindi", async () => {
        await i18n.changeLanguage("hi");
        render({ name: "आशा वर्मा" });
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "स्वागत है, आशा वर्मा",
            })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("region", { name: "आगे क्या आएगा" })
        ).toBeInTheDocument();
    });

    it("passes an axe smoke test", async () => {
        const { container } = render({ role: "admin" });
        await expectAccessible(container);
    });
});
