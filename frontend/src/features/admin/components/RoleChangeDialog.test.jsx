import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { makeAdminUser } from "@/mocks/fixtures/adminUser";
import {
    LEARNER,
    accounts,
    openMenu,
    renderUsers,
    registerAdminTestHooks,
    useList,
} from "@/test/adminUsersHarness";
import { setupMockServer } from "@/test/mockServerLifecycle";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const server = setupMockServer();
registerAdminTestHooks();

describe("AdminUsersPage role change", () => {
    async function openRoleDialog(name = "Ravi Kumar") {
        await screen.findByRole("table");
        await openMenu(name);
        await userEvent.click(
            await screen.findByRole("menuitem", { name: "Change role…" })
        );
        return screen.findByRole("dialog");
    }

    it("lists the three roles with the current one disabled, warns about sign-out and needs a choice", async () => {
        useList(accounts());
        renderUsers({ role: "superadmin" });
        const dialog = await openRoleDialog();
        expect(
            within(dialog).getByText("Change the role of Ravi Kumar")
        ).toBeVisible();
        expect(
            within(dialog).getByRole("radio", { name: /Learner/ })
        ).toBeDisabled();
        expect(
            within(dialog).getByRole("radio", { name: "Trainer" })
        ).toBeEnabled();
        expect(
            within(dialog).getByRole("radio", { name: "Admin" })
        ).toBeEnabled();
        expect(
            within(dialog).queryByRole("radio", { name: /Platform admin/ })
        ).toBeNull();
        expect(
            within(dialog).getByText(
                /will be signed out on all devices and sees the new role/
            )
        ).toBeVisible();
        expect(
            within(dialog).getByRole("button", { name: "Change role" })
        ).toBeDisabled();
    });

    it("changes the role, toasts and closes", async () => {
        useList(accounts());
        let patched = null;
        server.use(
            http.patch(
                apiUrl("/admin/users/:id/role"),
                async ({ params, request }) => {
                    patched = { id: params.id, ...(await request.json()) };
                    return okResponse({
                        user: makeAdminUser({ id: params.id, role: "trainer" }),
                    });
                }
            )
        );
        renderUsers({ role: "superadmin" });
        const dialog = await openRoleDialog();
        await userEvent.click(
            within(dialog).getByRole("radio", { name: "Trainer" })
        );
        await userEvent.click(
            within(dialog).getByRole("button", { name: "Change role" })
        );
        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith(
                "Ravi Kumar is now Trainer.",
                expect.anything()
            )
        );
        expect(patched).toEqual({ id: LEARNER, role: "trainer" });
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it.each([
        [409, "LAST_ADMIN", "You cannot remove the last active administrator."],
        [
            403,
            "SELF_ACTION_FORBIDDEN",
            "You cannot do this to your own account.",
        ],
        [
            404,
            "NOT_FOUND",
            "This account no longer exists or is not available to you. The list was refreshed.",
        ],
        [
            409,
            "CONFLICT",
            "This account changed in the meantime, or the change is not possible. The list was refreshed.",
        ],
    ])(
        "keeps the dialog open and shows %s %s inside it",
        async (status, code, text) => {
            useList(accounts());
            server.use(
                http.patch(apiUrl("/admin/users/:id/role"), () =>
                    errorResponse(status, code)
                )
            );
            renderUsers({ role: "superadmin" });
            const dialog = await openRoleDialog("Anil Rao");
            await userEvent.click(
                within(dialog).getByRole("radio", { name: "Learner" })
            );
            await userEvent.click(
                within(dialog).getByRole("button", { name: "Change role" })
            );
            const alert = await within(dialog).findByRole("alert");
            expect(within(alert).getByText(text)).toBeVisible();
            expect(screen.getByRole("dialog")).toBeVisible();
        }
    );

    it("sends one request on a double click", async () => {
        useList(accounts());
        let patches = 0;
        server.use(
            http.patch(apiUrl("/admin/users/:id/role"), async ({ params }) => {
                patches += 1;
                await new Promise((resolve) => setTimeout(resolve, 30));
                return okResponse({
                    user: makeAdminUser({ id: params.id, role: "admin" }),
                });
            })
        );
        renderUsers({ role: "superadmin" });
        const dialog = await openRoleDialog();
        await userEvent.click(
            within(dialog).getByRole("radio", { name: "Admin" })
        );
        await userEvent.dblClick(
            within(dialog).getByRole("button", { name: "Change role" })
        );
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
        expect(patches).toBe(1);
    });
});
