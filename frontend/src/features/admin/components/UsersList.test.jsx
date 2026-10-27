import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import {
    apiUrl,
    errorResponse,
    okResponse,
    pageMeta,
} from "@/mocks/fixtures/envelope";
import { makeAdminUser } from "@/mocks/fixtures/adminUser";
import {
    LEARNER,
    SUSPENDED,
    accounts,
    openMenu,
    renderUsers,
    rowOf,
    registerAdminTestHooks,
    useList,
    usersUrl,
} from "@/test/adminUsersHarness";
import { setupMockServer } from "@/test/mockServerLifecycle";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const server = setupMockServer();
registerAdminTestHooks();

describe("AdminUsersPage list states", () => {
    it("shows a loading status, then the accounts with role and status text and a You badge", async () => {
        useList(accounts());
        renderUsers({ role: "superadmin" });
        expect(
            screen.getByRole("heading", { level: 1, name: "Users" })
        ).toBeVisible();
        expect(
            screen.getByRole("status", { name: "Loading users" })
        ).toBeVisible();
        await screen.findByRole("table");
        expect(within(rowOf("Ravi Kumar")).getByText("Learner")).toBeVisible();
        expect(within(rowOf("Ravi Kumar")).getByText("Active")).toBeVisible();
        expect(within(rowOf("Sunil Das")).getByText("Suspended")).toBeVisible();
        expect(
            within(rowOf("Priya Root")).getByText("Platform admin")
        ).toBeVisible();
        expect(within(rowOf("Asha Verma")).getByText("You")).toBeVisible();
    });

    it("shows an empty state and a filtered empty state with a way back", async () => {
        useList([]);
        const { unmount } = renderUsers();
        expect(await screen.findByText("No accounts to show")).toBeVisible();
        unmount();
        const { router } = renderUsers({
            entry: "/admin/users?q=zz&role=trainer",
        });
        expect(
            await screen.findByText("No accounts match these filters")
        ).toBeVisible();
        // The filter bar and the empty-state card both offer "Clear filters": use the card's own way back.
        const card = screen.getByText(
            "No accounts match these filters"
        ).parentElement;
        await userEvent.click(
            within(card).getByRole("button", { name: "Clear filters" })
        );
        await waitFor(() => expect(router.state.location.search).toBe(""));
    });

    it("shows a failed read with Retry", async () => {
        let calls = 0;
        server.use(
            http.get(usersUrl, () => {
                calls += 1;
                return calls === 1
                    ? errorResponse(500, "SERVER_ERROR")
                    : okResponse(
                          { users: accounts() },
                          { meta: pageMeta({ total: 7 }) }
                      );
            })
        );
        renderUsers();
        expect(
            await screen.findByRole("button", { name: "Try again" })
        ).toBeVisible();
        await userEvent.click(
            screen.getByRole("button", { name: "Try again" })
        );
        expect(await screen.findByRole("table")).toBeVisible();
    });

    it("keeps the search, role and status in the URL and sends them to the API", async () => {
        const searches = [];
        server.use(
            http.get(usersUrl, ({ request }) => {
                searches.push(new URL(request.url).search);
                return okResponse(
                    { users: accounts() },
                    { meta: pageMeta({ total: 7 }) }
                );
            })
        );
        const { router } = renderUsers({
            role: "superadmin",
            entry: "/admin/users?page=1",
        });
        await screen.findByRole("table");
        await userEvent.type(
            screen.getByRole("searchbox", { name: "Search by email" }),
            "ra"
        );
        await waitFor(
            () => expect(router.state.location.search).toBe("?q=ra"),
            { timeout: 3000 }
        );
        await waitFor(() => expect(searches.at(-1)).toContain("q=ra"));
        await userEvent.click(screen.getByRole("combobox", { name: "Role" }));
        await userEvent.click(
            await screen.findByRole("option", { name: "Trainer" })
        );
        await userEvent.click(screen.getByRole("combobox", { name: "Status" }));
        await userEvent.click(
            await screen.findByRole("option", { name: "Suspended" })
        );
        await waitFor(() =>
            expect(router.state.location.search).toBe(
                "?q=ra&role=trainer&status=suspended"
            )
        );
        await waitFor(() =>
            expect(searches.at(-1)).toContain("status=suspended")
        );
    });

    it("offers the Platform admin role filter to platform admins only", async () => {
        useList(accounts());
        const { unmount } = renderUsers({ role: "admin" });
        await screen.findByRole("table");
        await userEvent.click(screen.getByRole("combobox", { name: "Role" }));
        expect(
            await screen.findByRole("option", { name: "Admin" })
        ).toBeVisible();
        expect(
            screen.queryByRole("option", { name: "Platform admin" })
        ).toBeNull();
        unmount();
        renderUsers({ role: "superadmin" });
        await screen.findByRole("table");
        await userEvent.click(screen.getByRole("combobox", { name: "Role" }));
        expect(
            await screen.findByRole("option", { name: "Platform admin" })
        ).toBeVisible();
    });

    it("pages with previous and next and writes the page to the URL", async () => {
        server.use(
            http.get(usersUrl, ({ request }) => {
                const page = Number(
                    new URL(request.url).searchParams.get("page")
                );
                return okResponse(
                    {
                        users: [
                            makeAdminUser({
                                id: `u${page}`,
                                name: `Person ${page}`,
                                email: `p${page}@example.test`,
                            }),
                        ],
                    },
                    { meta: pageMeta({ page, total: 45 }) }
                );
            })
        );
        const { router } = renderUsers();
        expect(await screen.findByText("Person 1")).toBeVisible();
        expect(
            screen.getByRole("button", { name: /Previous page/ })
        ).toBeDisabled();
        await userEvent.click(
            screen.getByRole("button", { name: /Next page/ })
        );
        expect(await screen.findByText("Person 2")).toBeVisible();
        expect(router.state.location.search).toBe("?page=2");
    });
});

describe("AdminUsersPage suspend and reactivate", () => {
    it("suspends only after the confirm dialog and then shows the new status", async () => {
        useList(accounts());
        let patched = null;
        server.use(
            http.patch(
                apiUrl("/admin/users/:id/status"),
                async ({ params, request }) => {
                    patched = { id: params.id, ...(await request.json()) };
                    return okResponse({
                        user: makeAdminUser({
                            id: params.id,
                            name: "Ravi Kumar",
                            email: "ravi@example.test",
                            status: "suspended",
                        }),
                    });
                }
            )
        );
        renderUsers();
        await screen.findByRole("table");
        const menu = await openMenu("Ravi Kumar");
        await userEvent.click(
            within(menu).getByRole("menuitem", { name: "Suspend" })
        );
        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByText("Suspend Ravi Kumar?")).toBeVisible();
        expect(patched).toBeNull();
        await userEvent.click(
            within(dialog).getByRole("button", { name: "Cancel" })
        );
        expect(patched).toBeNull();
        await userEvent.click(
            await (async () => {
                await openMenu("Ravi Kumar");
                return screen.findByRole("menuitem", { name: "Suspend" });
            })()
        );
        await userEvent.click(
            within(await screen.findByRole("alertdialog")).getByRole("button", {
                name: "Suspend account",
            })
        );
        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith(
                "Ravi Kumar was suspended.",
                expect.anything()
            )
        );
        expect(patched).toEqual({ id: LEARNER, status: "suspended" });
    });

    it("reactivates after a neutral confirm dialog", async () => {
        useList(accounts());
        let patched = null;
        server.use(
            http.patch(
                apiUrl("/admin/users/:id/status"),
                async ({ params, request }) => {
                    patched = { id: params.id, ...(await request.json()) };
                    return okResponse({
                        user: makeAdminUser({
                            id: params.id,
                            name: "Sunil Das",
                        }),
                    });
                }
            )
        );
        renderUsers();
        await screen.findByRole("table");
        await openMenu("Sunil Das");
        await userEvent.click(
            await screen.findByRole("menuitem", { name: "Reactivate" })
        );
        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByText("Reactivate Sunil Das?")).toBeVisible();
        await userEvent.click(
            within(dialog).getByRole("button", { name: "Reactivate account" })
        );
        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith(
                "Sunil Das was reactivated.",
                expect.anything()
            )
        );
        expect(patched).toEqual({ id: SUSPENDED, status: "active" });
    });

    it.each([
        [
            403,
            "SELF_ACTION_FORBIDDEN",
            "You cannot do this to your own account.",
        ],
        [403, "FORBIDDEN", "You cannot manage this account."],
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
        [409, "LAST_ADMIN", "You cannot remove the last active administrator."],
    ])("maps a %s %s answer to its own message", async (status, code, text) => {
        useList(accounts());
        server.use(
            http.patch(apiUrl("/admin/users/:id/status"), () =>
                errorResponse(status, code)
            )
        );
        renderUsers({ role: "superadmin" });
        await screen.findByRole("table");
        await openMenu("Ravi Kumar");
        await userEvent.click(
            await screen.findByRole("menuitem", { name: "Suspend" })
        );
        await userEvent.click(
            within(await screen.findByRole("alertdialog")).getByRole("button", {
                name: "Suspend account",
            })
        );
        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(text, {
                id: "admin-failed",
            })
        );
    });
});
