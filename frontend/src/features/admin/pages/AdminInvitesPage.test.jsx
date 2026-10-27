import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { expectAccessible } from "@/test/axeCheck";
import {
    renderInvites,
    sentInvites,
    registerAdminTestHooks,
    useList,
} from "@/test/adminInvitesHarness";
import { setupMockServer } from "@/test/mockServerLifecycle";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

setupMockServer();
registerAdminTestHooks();

describe("AdminInvitesPage language and accessibility", () => {
    it("renders in Hindi", async () => {
        await i18n.changeLanguage("hi");
        useList(sentInvites());
        renderInvites({ role: "superadmin" });
        expect(
            await screen.findByRole("heading", {
                level: 1,
                name: "टीम आमंत्रण",
            })
        ).toBeVisible();
        expect(await screen.findByRole("table")).toBeVisible();
        expect(screen.getByText("आमंत्रण भेजें")).toBeVisible();
        expect(
            screen.getByText("भेजा गया", { selector: "span" })
        ).toBeVisible();
        expect(screen.queryByText("superadmin")).toBeNull();
    });

    it("has no axe violations with data, and with the empty state", async () => {
        useList(sentInvites());
        const { container, unmount } = renderInvites({ role: "superadmin" });
        await screen.findByRole("table");
        await expectAccessible(container);
        unmount();
        useList([]);
        const second = renderInvites();
        await screen.findByText("No invitations yet");
        await expectAccessible(second.container);
    });
});
