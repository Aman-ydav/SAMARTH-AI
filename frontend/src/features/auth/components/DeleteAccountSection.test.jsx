import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteAccountSection } from "@/features/auth/components/DeleteAccountSection";
import { i18n } from "@/i18n";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { expectAccessible } from "@/test/axeCheck";
import { fakeGoogle } from "@/test/googleSignInMock";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { renderWithUser } from "@/test/renderSettings";

const mocks = vi.hoisted(() => ({ env: {} }));

vi.mock("@/lib/env", async (importOriginal) => {
    const actual = await importOriginal();
    Object.assign(mocks.env, actual.env);
    return { env: mocks.env };
});
vi.mock("@react-oauth/google", async () =>
    (await import("@/test/googleSignInMock")).createGoogleModuleMock()
);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const server = setupMockServer();
const deleteUrl = apiUrl("/auth/account");

beforeEach(() => {
    Object.assign(mocks.env, {
        googleEnabled: true,
        googleClientId: "client-id.example.test",
    });
    vi.mocked(toast.success).mockClear();
});
afterEach(async () => {
    await i18n.changeLanguage("en");
});

function track(
    response = () => okResponse({ graceEndsAt: "2026-11-25T09:00:00.000Z" })
) {
    const bodies = [];
    server.use(
        http.delete(deleteUrl, async ({ request }) => {
            bodies.push(await request.json());
            return response();
        })
    );
    return bodies;
}

async function openDialog(user) {
    await user.click(
        screen.getByRole("button", { name: "Delete my account…" })
    );
    return screen.findByRole("alertdialog");
}
async function fill(user, label, value) {
    await user.click(screen.getByLabelText(label));
    await user.paste(value);
}
const confirmField = "Type DELETE to confirm";
const submit = (dialog) =>
    within(dialog).getByRole("button", { name: "Delete my account" });

describe("DeleteAccountSection", () => {
    it("is a labelled danger zone that opens nothing by itself", () => {
        renderWithUser(DeleteAccountSection);
        expect(
            screen.getByRole("heading", { level: 2, name: "Delete account" })
        ).toBeVisible();
        expect(screen.getByText(/30 days to change your mind/)).toBeVisible();
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("explains the grace period and asks for the phrase and the password", async () => {
        const user = userEvent.setup();
        renderWithUser(DeleteAccountSection);
        const dialog = await openDialog(user);
        expect(
            within(dialog).getByText(
                /If you log in within 30 days, the deletion is cancelled/
            )
        ).toBeVisible();
        expect(within(dialog).getByLabelText(confirmField)).toBeVisible();
        expect(within(dialog).getByLabelText("Current password")).toBeVisible();
        expect(
            within(dialog).queryByText(/last active administrator/)
        ).not.toBeInTheDocument();
        await expectAccessible(document.body);
    });

    it("warns administrators about the last-admin rule", async () => {
        const user = userEvent.setup();
        renderWithUser(DeleteAccountSection, { user: { role: "admin" } });
        const dialog = await openDialog(user);
        expect(
            within(dialog).getByText(/last active administrator/)
        ).toBeVisible();
    });

    it("sends nothing until the phrase and the password are right", async () => {
        const bodies = track();
        const user = userEvent.setup();
        renderWithUser(DeleteAccountSection);
        const dialog = await openDialog(user);
        await user.click(submit(dialog));
        expect(
            await within(dialog).findByText(
                "Type the confirmation word exactly as shown."
            )
        ).toBeVisible();
        await fill(user, confirmField, "remove");
        await fill(user, "Current password", "old password 1");
        await user.click(submit(dialog));
        expect(
            within(dialog).getByText(
                "Type the confirmation word exactly as shown."
            )
        ).toBeVisible();
        expect(bodies).toEqual([]);
    });

    it("accepts the phrase in any case and deletes: session ends, toast names the last day", async () => {
        const bodies = track();
        const user = userEvent.setup();
        const { store } = renderWithUser(DeleteAccountSection);
        const dialog = await openDialog(user);
        await fill(user, confirmField, "delete");
        await fill(user, "Current password", "old password 1");
        await user.click(submit(dialog));
        await waitFor(() => expect(store.getState().auth.user).toBeNull());
        expect(bodies).toEqual([{ currentPassword: "old password 1" }]);
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
        const [message, options] = vi.mocked(toast.success).mock.calls[0];
        expect(message).toMatch(/Log in before .*2026 to cancel/);
        expect(options).toEqual({ id: "account-deleted" });
        expect(store.getState().auth.sessionEnd).toBe("LOGOUT");
        expect(JSON.stringify(store.getState())).not.toContain(
            "old password 1"
        );
    });

    it("falls back to a date-free message when the server sends no date", async () => {
        track(() => okResponse({}));
        const user = userEvent.setup();
        renderWithUser(DeleteAccountSection);
        const dialog = await openDialog(user);
        await fill(user, confirmField, "DELETE");
        await fill(user, "Current password", "old password 1");
        await user.click(submit(dialog));
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
        expect(vi.mocked(toast.success).mock.calls[0][0]).toBe(
            "Your account is scheduled for deletion. Log in within 30 days to cancel."
        );
    });

    it("sends one request for a double click", async () => {
        const bodies = track();
        const user = userEvent.setup();
        renderWithUser(DeleteAccountSection);
        const dialog = await openDialog(user);
        await fill(user, confirmField, "DELETE");
        await fill(user, "Current password", "old password 1");
        await user.dblClick(submit(dialog));
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
        expect(bodies).toHaveLength(1);
    });

    it("puts a wrong password on its field and keeps the account", async () => {
        track(() => errorResponse(401, "INVALID_CREDENTIALS"));
        const user = userEvent.setup();
        const { store } = renderWithUser(DeleteAccountSection);
        const dialog = await openDialog(user);
        await fill(user, confirmField, "DELETE");
        await fill(user, "Current password", "wrong password");
        await user.click(submit(dialog));
        expect(
            await within(dialog).findByText("Invalid email or password.")
        ).toBeVisible();
        expect(store.getState().auth.user).not.toBeNull();
    });

    it("explains LAST_ADMIN above the button and keeps the dialog open", async () => {
        track(() => errorResponse(409, "LAST_ADMIN"));
        const user = userEvent.setup();
        const { store } = renderWithUser(DeleteAccountSection, {
            user: { role: "admin" },
        });
        const dialog = await openDialog(user);
        await fill(user, confirmField, "DELETE");
        await fill(user, "Current password", "old password 1");
        await user.click(submit(dialog));
        expect(await within(dialog).findByRole("alert")).toHaveTextContent(
            "You cannot remove the last active administrator."
        );
        expect(screen.getByRole("alertdialog")).toBeVisible();
        expect(store.getState().auth.user).not.toBeNull();
        expect(toast.success).not.toHaveBeenCalled();
    });

    it("starts from a clean form every time the dialog opens", async () => {
        const bodies = track();
        const user = userEvent.setup();
        renderWithUser(DeleteAccountSection);
        let dialog = await openDialog(user);
        await fill(user, confirmField, "DELETE");
        await user.click(
            within(dialog).getByRole("button", { name: "Cancel" })
        );
        await waitFor(() =>
            expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
        );
        dialog = await openDialog(user);
        expect(within(dialog).getByLabelText(confirmField)).toHaveValue("");
        expect(bodies).toEqual([]);
    });
});

describe("DeleteAccountSection for a Google-only account", () => {
    const googleOnly = { hasPassword: false, authProviders: ["google"] };

    it("needs the phrase and a Google confirmation, then sends the credential", async () => {
        const bodies = track();
        const user = userEvent.setup();
        renderWithUser(DeleteAccountSection, { user: googleOnly });
        const dialog = await openDialog(user);
        expect(
            within(dialog).queryByLabelText("Current password")
        ).not.toBeInTheDocument();
        await fill(user, confirmField, "DELETE");
        expect(submit(dialog)).toBeDisabled();
        await user.click(
            within(dialog).getByRole("button", { name: "fake google ok" })
        );
        await user.click(submit(dialog));
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
        expect(bodies).toEqual([{ credential: fakeGoogle.credential }]);
    });
});

describe("DeleteAccountSection Hindi", () => {
    it("keeps the typed phrase DELETE and translates the rest", async () => {
        await i18n.changeLanguage("hi");
        const user = userEvent.setup();
        renderWithUser(DeleteAccountSection);
        await user.click(
            screen.getByRole("button", { name: "मेरा खाता हटाएँ…" })
        );
        const dialog = await screen.findByRole("alertdialog");
        expect(
            within(dialog).getByLabelText("पुष्टि के लिए DELETE लिखें")
        ).toBeVisible();
        await expectAccessible(document.body);
    });
});
