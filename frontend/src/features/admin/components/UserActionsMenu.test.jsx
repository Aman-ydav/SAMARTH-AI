import { screen, within } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { okResponse, pageMeta } from "@/mocks/fixtures/envelope";
import { makeAdminUser } from "@/mocks/fixtures/adminUser";
import {
    SELF_ID,
    accounts,
    menuOf,
    openMenu,
    renderUsers,
    registerAdminTestHooks,
    useList,
    usersUrl,
} from "@/test/adminUsersHarness";
import { setupMockServer } from "@/test/mockServerLifecycle";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const server = setupMockServer();
registerAdminTestHooks();

describe("AdminUsersPage role-based visibility of actions", () => {
    it("lets an admin act on learners and trainers only, never on admins, platform admins or themselves", async () => {
        useList(accounts());
        renderUsers({ role: "admin" });
        await screen.findByRole("table");
        expect(menuOf("Ravi Kumar")).toBeVisible();
        expect(menuOf("Tara Singh")).toBeVisible();
        expect(menuOf("Sunil Das")).toBeVisible();
        expect(menuOf("Anil Rao")).toBeNull();
        expect(menuOf("Priya Root")).toBeNull();
        expect(menuOf("Asha Verma")).toBeNull();
        expect(menuOf("Nina Paul")).toBeNull();
        const menu = await openMenu("Ravi Kumar");
        expect(
            within(menu).getByRole("menuitem", { name: "Suspend" })
        ).toBeVisible();
        expect(
            within(menu).queryByRole("menuitem", { name: /Change role/ })
        ).toBeNull();
    });

    it("lets a platform admin also manage admins and change roles, but never platform admins or themselves", async () => {
        server.use(
            http.get(usersUrl, () =>
                okResponse(
                    {
                        users: [
                            ...accounts().slice(0, 4),
                            makeAdminUser({
                                id: SELF_ID,
                                name: "Asha Verma",
                                role: "superadmin",
                            }),
                        ],
                    },
                    { meta: pageMeta({ total: 5 }) }
                )
            )
        );
        renderUsers({ role: "superadmin" });
        await screen.findByRole("table");
        expect(menuOf("Anil Rao")).toBeVisible();
        expect(menuOf("Priya Root")).toBeNull();
        expect(menuOf("Asha Verma")).toBeNull();
        const menu = await openMenu("Ravi Kumar");
        expect(
            within(menu).getByRole("menuitem", { name: "Suspend" })
        ).toBeVisible();
        expect(
            within(menu).getByRole("menuitem", { name: "Change role…" })
        ).toBeVisible();
    });

    it("offers Reactivate for a suspended account", async () => {
        useList(accounts());
        renderUsers({ role: "admin" });
        await screen.findByRole("table");
        const menu = await openMenu("Sunil Das");
        expect(
            within(menu).getByRole("menuitem", { name: "Reactivate" })
        ).toBeVisible();
        expect(
            within(menu).queryByRole("menuitem", { name: "Suspend" })
        ).toBeNull();
    });
});
