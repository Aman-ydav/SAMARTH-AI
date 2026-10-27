import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { expectAccessible } from "@/test/axeCheck";
import {
    accounts,
    openMenu,
    renderUsers,
    registerAdminTestHooks,
    useList,
} from "@/test/adminUsersHarness";
import { setupMockServer } from "@/test/mockServerLifecycle";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

setupMockServer();
registerAdminTestHooks();

describe("AdminUsersPage language and accessibility", () => {
    it("renders in Hindi with Platform admin spelled out as a role name", async () => {
        await i18n.changeLanguage("hi");
        useList(accounts());
        renderUsers({ role: "superadmin" });
        expect(
            await screen.findByRole("heading", { level: 1, name: "उपयोगकर्ता" })
        ).toBeVisible();
        await screen.findByRole("table");
        expect(
            screen.getByText("प्लेटफ़ॉर्म प्रशासक", { selector: "span" })
        ).toBeVisible();
        expect(
            screen.getByRole("searchbox", { name: "ईमेल से खोजें" })
        ).toBeVisible();
        expect(screen.queryByText(/superadmin/i)).toBeNull();
    });

    it("has no axe violations with data, with the menu open and with the role dialog open", async () => {
        useList(accounts());
        const { container } = renderUsers({ role: "superadmin" });
        await screen.findByRole("table");
        await expectAccessible(container);
        await openMenu("Ravi Kumar");
        await userEvent.click(
            await screen.findByRole("menuitem", { name: "Change role…" })
        );
        const dialog = await screen.findByRole("dialog");
        await expectAccessible(dialog);
    });
});
