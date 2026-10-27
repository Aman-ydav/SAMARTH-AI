import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { errorResponse, okResponse, pageMeta } from "@/mocks/fixtures/envelope";
import { makeInvite } from "@/mocks/fixtures/invite";
import {
    invitesUrl,
    renderInvites,
    registerAdminTestHooks,
    useList,
} from "@/test/adminInvitesHarness";
import { setupMockServer } from "@/test/mockServerLifecycle";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const server = setupMockServer();
registerAdminTestHooks();

describe("AdminInvitesPage invite form", () => {
    it("offers only Trainer to an admin and Trainer and Admin to a platform admin", async () => {
        useList([]);
        const { unmount } = renderInvites({ role: "admin" });
        await screen.findByText("No invitations yet");
        await userEvent.click(screen.getByRole("combobox", { name: "Role" }));
        expect(
            (await screen.findAllByRole("option")).map((o) => o.textContent)
        ).toEqual(["Trainer"]);
        unmount();

        renderInvites({ role: "superadmin" });
        await screen.findByText("No invitations yet");
        await userEvent.click(screen.getByRole("combobox", { name: "Role" }));
        expect(
            (await screen.findAllByRole("option")).map((o) => o.textContent)
        ).toEqual(["Trainer", "Admin"]);
        expect(
            screen.queryByRole("option", { name: "Platform admin" })
        ).toBeNull();
        expect(screen.queryByRole("option", { name: "Learner" })).toBeNull();
    });

    it("validates on submit: asks for the email and, for a platform admin, a role", async () => {
        useList([]);
        renderInvites({ role: "superadmin" });
        await screen.findByText("No invitations yet");
        await userEvent.click(
            screen.getByRole("button", { name: "Send invitation" })
        );
        expect(
            await screen.findByText("Enter your email address.")
        ).toBeVisible();
        expect(
            screen.getByText("Choose a role for the invitation.")
        ).toBeVisible();
        await userEvent.type(screen.getByLabelText("Email address"), "nope");
        await userEvent.click(
            screen.getByRole("button", { name: "Send invitation" })
        );
        expect(
            await screen.findByText("Enter a valid email address.")
        ).toBeVisible();
    });

    it("sends the normalised email and the preselected role, toasts, resets and reads the list again", async () => {
        let body = null;
        let reads = 0;
        server.use(
            http.get(invitesUrl, () => {
                reads += 1;
                return okResponse({ invites: [] }, { meta: pageMeta() });
            }),
            http.post(invitesUrl, async ({ request }) => {
                body = await request.json();
                return okResponse(
                    { invite: makeInvite({ email: body.email }) },
                    { status: 201 }
                );
            })
        );
        renderInvites();
        await screen.findByText("No invitations yet");
        await userEvent.type(
            screen.getByLabelText("Email address"),
            "  New.Person@Example.TEST "
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Send invitation" })
        );
        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith(
                "Invitation sent to new.person@example.test.",
                { id: "invite-sent" }
            )
        );
        expect(body).toEqual({
            email: "new.person@example.test",
            role: "trainer",
        });
        expect(screen.getByLabelText("Email address")).toHaveValue("");
        await waitFor(() => expect(reads).toBeGreaterThan(1));
    });

    it("sends one request on a double click", async () => {
        useList([]);
        let posts = 0;
        server.use(
            http.post(invitesUrl, async () => {
                posts += 1;
                await new Promise((resolve) => setTimeout(resolve, 30));
                return okResponse({ invite: makeInvite() }, { status: 201 });
            })
        );
        renderInvites();
        await screen.findByText("No invitations yet");
        await userEvent.type(
            screen.getByLabelText("Email address"),
            "a@example.test"
        );
        const button = screen.getByRole("button", { name: "Send invitation" });
        await userEvent.dblClick(button);
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
        expect(posts).toBe(1);
    });

    it("answers a 409 with one neutral text on the email field and keeps what was typed", async () => {
        useList([]);
        server.use(http.post(invitesUrl, () => errorResponse(409, "CONFLICT")));
        renderInvites();
        await screen.findByText("No invitations yet");
        await userEvent.type(
            screen.getByLabelText("Email address"),
            "taken@example.test"
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Send invitation" })
        );
        const message = await screen.findByText(
            "This email address already has an account or an open invitation."
        );
        expect(message).toBeVisible();
        expect(screen.getByLabelText("Email address")).toHaveAttribute(
            "aria-invalid",
            "true"
        );
        expect(screen.getByLabelText("Email address")).toHaveValue(
            "taken@example.test"
        );
        expect(toast.success).not.toHaveBeenCalled();
    });

    it("shows the domain error on the field and other failures above the button with the wait", async () => {
        useList([]);
        server.use(
            http.post(invitesUrl, () =>
                errorResponse(403, "DOMAIN_NOT_ALLOWED")
            )
        );
        renderInvites();
        await screen.findByText("No invitations yet");
        await userEvent.type(
            screen.getByLabelText("Email address"),
            "a@other.test"
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Send invitation" })
        );
        expect(
            await screen.findByText("This email domain is not allowed.")
        ).toBeVisible();

        server.use(
            http.post(invitesUrl, () =>
                errorResponse(429, "RATE_LIMITED", {
                    headers: { "Retry-After": "30" },
                })
            )
        );
        await userEvent.clear(screen.getByLabelText("Email address"));
        await userEvent.type(
            screen.getByLabelText("Email address"),
            "b@example.test"
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Send invitation" })
        );
        const alert = await screen.findByRole("alert");
        expect(within(alert).getByText(/Too many requests/)).toBeVisible();
    });

    it("maps a server-side field error onto the field", async () => {
        useList([]);
        server.use(
            http.post(invitesUrl, () =>
                errorResponse(400, "VALIDATION_ERROR", {
                    errors: [
                        {
                            field: "email",
                            message: "Enter a valid email address",
                        },
                    ],
                })
            )
        );
        renderInvites();
        await screen.findByText("No invitations yet");
        await userEvent.type(
            screen.getByLabelText("Email address"),
            "a@example.test"
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Send invitation" })
        );
        expect(
            await screen.findByText("Enter a valid email address")
        ).toBeVisible();
    });
});
