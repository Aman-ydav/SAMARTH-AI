import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { NotificationsBell } from "@/components/layout/NotificationsBell";
import { expectAccessible } from "@/test/axeCheck";
import { renderWithProviders } from "@/test/renderWithProviders";

describe("NotificationsBell", () => {
    it("shows no badge and an empty state when there is nothing unread", async () => {
        renderWithProviders(<NotificationsBell />);
        const bell = screen.getByRole("button", { name: "Notifications" });
        expect(bell).toHaveTextContent("");
        await userEvent.click(bell);
        expect(screen.getByText("You are all caught up")).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "View all notifications" })
        ).toHaveAttribute("href", "/notifications");
    });

    it("announces the unread count in the button name and shows the number", () => {
        renderWithProviders(<NotificationsBell unreadCount={3} />);
        const bell = screen.getByRole("button", {
            name: "Notifications, 3 unread",
        });
        expect(bell).toHaveTextContent("3");
    });

    it("caps the badge at 99+", () => {
        renderWithProviders(<NotificationsBell unreadCount={250} />);
        expect(
            screen.getByRole("button", { name: "Notifications, 250 unread" })
        ).toHaveTextContent("99+");
    });

    it.each([[-4], [Number.NaN], ["7"], [undefined], [null]])(
        "treats %s as no unread notifications",
        (value) => {
            renderWithProviders(<NotificationsBell unreadCount={value} />);
            expect(
                screen.getByRole("button", { name: "Notifications" })
            ).toHaveTextContent("");
        }
    );

    it("closes with Escape and returns focus to the bell", async () => {
        renderWithProviders(<NotificationsBell />);
        const bell = screen.getByRole("button", { name: "Notifications" });
        await userEvent.click(bell);
        await userEvent.keyboard("{Escape}");
        expect(bell).toHaveFocus();
    });

    it("passes an axe smoke test with the popover open", async () => {
        renderWithProviders(<NotificationsBell unreadCount={2} />);
        await userEvent.click(
            screen.getByRole("button", { name: "Notifications, 2 unread" })
        );
        await expectAccessible(document.body);
    });
});
