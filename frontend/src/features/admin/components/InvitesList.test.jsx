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
import { makeInvite } from "@/mocks/fixtures/invite";
import {
    INVITE_ID,
    invitesUrl,
    renderInvites,
    sentInvites,
    registerAdminTestHooks,
    useList,
} from "@/test/adminInvitesHarness";
import { setupMockServer } from "@/test/mockServerLifecycle";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const server = setupMockServer();
registerAdminTestHooks();

describe("AdminInvitesPage list states", () => {
    it("shows a loading status, then the invitations with status text and row actions only for open ones", async () => {
        useList(sentInvites());
        renderInvites();
        expect(
            screen.getByRole("heading", { level: 1, name: "Team invitations" })
        ).toBeVisible();
        expect(
            screen.getByRole("status", { name: "Loading invitations" })
        ).toBeVisible();
        const table = await screen.findByRole("table");
        const rows = within(table).getAllByRole("row");
        expect(rows).toHaveLength(4);
        expect(within(rows[1]).getByText("Sent")).toBeVisible();
        expect(within(rows[2]).getByText("Accepted")).toBeVisible();
        expect(within(rows[3]).getByText("Expired")).toBeVisible();
        expect(within(rows[1]).getAllByRole("button")).toHaveLength(2);
        expect(within(rows[2]).queryAllByRole("button")).toHaveLength(0);
    });

    it("shows an empty state with the form still available", async () => {
        useList([]);
        renderInvites();
        expect(await screen.findByText("No invitations yet")).toBeVisible();
        expect(screen.getByLabelText("Email address")).toBeVisible();
    });

    it("words the empty state differently under a filter and clears it", async () => {
        useList([]);
        const { router } = renderInvites({
            entry: "/admin/invites?status=revoked",
        });
        expect(
            await screen.findByText("No invitations match this filter")
        ).toBeVisible();
        await userEvent.click(
            screen.getByRole("button", { name: "Clear filter" })
        );
        await waitFor(() => expect(router.state.location.search).toBe(""));
    });

    it("shows a failed read with Retry that reads again", async () => {
        let calls = 0;
        server.use(
            http.get(invitesUrl, () => {
                calls += 1;
                return calls === 1
                    ? errorResponse(500, "SERVER_ERROR", {
                          requestId: "req-77",
                      })
                    : okResponse(
                          { invites: [makeInvite()] },
                          { meta: pageMeta({ total: 1 }) }
                      );
            })
        );
        renderInvites();
        expect(
            await screen.findByText(
                "The server ran into a problem. Please try again."
            )
        ).toBeVisible();
        expect(screen.getByText("Request ID: req-77")).toBeVisible();
        await userEvent.click(
            screen.getByRole("button", { name: "Try again" })
        );
        expect(await screen.findByRole("table")).toBeVisible();
    });

    it("sends the status filter from the URL and writes a changed filter back with replace", async () => {
        const searches = [];
        server.use(
            http.get(invitesUrl, ({ request }) => {
                searches.push(new URL(request.url).search);
                return okResponse(
                    { invites: [makeInvite()] },
                    { meta: pageMeta({ total: 1 }) }
                );
            })
        );
        const { router } = renderInvites({
            entry: "/admin/invites?status=sent&page=1",
        });
        await screen.findByRole("table");
        expect(searches[0]).toContain("status=sent");
        await userEvent.click(
            screen.getByRole("combobox", { name: "Filter by status" })
        );
        await userEvent.click(
            await screen.findByRole("option", { name: "Revoked" })
        );
        await waitFor(() =>
            expect(router.state.location.search).toBe("?status=revoked")
        );
        await waitFor(() =>
            expect(searches.at(-1)).toContain("status=revoked")
        );
    });

    it("pages through results and returns to the last page when the URL is past the end", async () => {
        server.use(
            http.get(invitesUrl, ({ request }) => {
                const page = Number(
                    new URL(request.url).searchParams.get("page")
                );
                return okResponse(
                    {
                        invites: [
                            makeInvite({
                                id: `p${page}`,
                                email: `p${page}@example.test`,
                            }),
                        ],
                    },
                    { meta: pageMeta({ page, limit: 20, total: 41 }) }
                );
            })
        );
        const { router } = renderInvites();
        expect(await screen.findByText("p1@example.test")).toBeVisible();
        expect(screen.getByText("41 results")).toBeVisible();
        await userEvent.click(
            screen.getByRole("button", { name: /Next page/ })
        );
        expect(await screen.findByText("p2@example.test")).toBeVisible();
        expect(router.state.location.search).toBe("?page=2");
        expect(screen.getByText("Page 2 of 3")).toBeVisible();
    });

    it("redirects a page beyond the last to the last page", async () => {
        server.use(
            http.get(invitesUrl, ({ request }) => {
                const page = Number(
                    new URL(request.url).searchParams.get("page")
                );
                return okResponse(
                    {
                        invites:
                            page > 3
                                ? []
                                : [
                                      makeInvite({
                                          id: `p${page}`,
                                          email: `p${page}@example.test`,
                                      }),
                                  ],
                    },
                    { meta: pageMeta({ page, limit: 20, total: 41 }) }
                );
            })
        );
        const { router } = renderInvites({ entry: "/admin/invites?page=9" });
        expect(await screen.findByText("p3@example.test")).toBeVisible();
        expect(router.state.location.search).toBe("?page=3");
    });
});

describe("AdminInvitesPage row actions", () => {
    it("revokes after a confirm dialog, toasts and reads the list again", async () => {
        useList(sentInvites());
        let revoked = null;
        server.use(
            http.delete(apiUrl("/admin/invites/:id"), ({ params }) => {
                revoked = params.id;
                return okResponse({
                    invite: makeInvite({ status: "revoked" }),
                });
            })
        );
        renderInvites();
        await userEvent.click(
            await screen.findByRole("button", {
                name: "Revoke the invitation for meera.nair@example.test",
            })
        );
        const dialog = await screen.findByRole("alertdialog");
        expect(
            within(dialog).getByText("Revoke this invitation?")
        ).toBeVisible();
        expect(revoked).toBeNull();
        await userEvent.click(
            within(dialog).getByRole("button", { name: "Cancel" })
        );
        expect(revoked).toBeNull();
        await userEvent.click(
            screen.getByRole("button", {
                name: "Revoke the invitation for meera.nair@example.test",
            })
        );
        await userEvent.click(
            within(await screen.findByRole("alertdialog")).getByRole("button", {
                name: "Revoke invitation",
            })
        );
        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith(
                "The invitation for meera.nair@example.test was revoked.",
                { id: `admin-done-${INVITE_ID}` }
            )
        );
        expect(revoked).toBe(INVITE_ID);
    });

    it("resends after a confirm dialog that states the resends used", async () => {
        useList(
            sentInvites()
                .slice(0, 1)
                .map((i) => ({ ...i, resentCount: 2 }))
        );
        let resent = false;
        server.use(
            http.post(apiUrl("/admin/invites/:id/resend"), () => {
                resent = true;
                return okResponse({ invite: makeInvite({ resentCount: 3 }) });
            })
        );
        renderInvites();
        await userEvent.click(
            await screen.findByRole("button", {
                name: "Resend the invitation to meera.nair@example.test",
            })
        );
        const dialog = await screen.findByRole("alertdialog");
        expect(
            within(dialog).getByText(/Resends used so far: 2 of 5/)
        ).toBeVisible();
        await userEvent.click(
            within(dialog).getByRole("button", { name: "Send again" })
        );
        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith(
                "Invitation sent again to meera.nair@example.test.",
                expect.anything()
            )
        );
        expect(resent).toBe(true);
    });

    it("disables Resend at the cap with the reason shown, and explains a 422 from the API", async () => {
        useList([makeInvite({ resentCount: 5 })]);
        renderInvites();
        const resend = await screen.findByRole("button", {
            name: "Resend the invitation to meera.nair@example.test",
        });
        expect(resend).toBeDisabled();
        expect(
            screen.getByText("Resend limit reached (5 resends).")
        ).toBeVisible();
        expect(resend).toHaveAccessibleDescription(
            "Resend limit reached (5 resends)."
        );
    });

    it("explains a 422 when the server counts the cap before the screen does", async () => {
        useList([makeInvite({ resentCount: 4 })]);
        server.use(
            http.post(apiUrl("/admin/invites/:id/resend"), () =>
                errorResponse(422, "UNPROCESSABLE")
            )
        );
        renderInvites();
        await userEvent.click(
            await screen.findByRole("button", {
                name: "Resend the invitation to meera.nair@example.test",
            })
        );
        await userEvent.click(
            within(await screen.findByRole("alertdialog")).getByRole("button", {
                name: "Send again",
            })
        );
        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                "This invitation reached the resend limit. Revoke it and send a new invitation instead.",
                { id: "admin-failed" }
            )
        );
    });

    it.each([
        [
            409,
            "CONFLICT",
            "This invitation can no longer be changed because it was already accepted or revoked. The list was refreshed.",
        ],
        [
            404,
            "NOT_FOUND",
            "This invitation no longer exists. The list was refreshed.",
        ],
        [
            429,
            "RATE_LIMITED",
            "Too many requests. Please wait a moment and try again.",
        ],
        [403, "FORBIDDEN", "You do not have permission to do that."],
    ])(
        "shows the right toast for a %s %s on revoke",
        async (status, code, text) => {
            let reads = 0;
            server.use(
                http.get(invitesUrl, () => {
                    reads += 1;
                    return okResponse(
                        { invites: [makeInvite()] },
                        { meta: pageMeta({ total: 1 }) }
                    );
                }),
                http.delete(apiUrl("/admin/invites/:id"), () =>
                    errorResponse(status, code)
                )
            );
            renderInvites();
            await userEvent.click(
                await screen.findByRole("button", {
                    name: "Revoke the invitation for meera.nair@example.test",
                })
            );
            await userEvent.click(
                within(await screen.findByRole("alertdialog")).getByRole(
                    "button",
                    { name: "Revoke invitation" }
                )
            );
            await waitFor(() =>
                expect(toast.error).toHaveBeenCalledWith(text, {
                    id: "admin-failed",
                })
            );
            if (status === 404 || status === 409)
                await waitFor(() => expect(reads).toBe(2));
            else expect(reads).toBe(1);
        }
    );
});
