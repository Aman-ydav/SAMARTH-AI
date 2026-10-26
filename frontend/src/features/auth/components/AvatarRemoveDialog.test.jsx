import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppSelector } from "@/app/hooks";
import { AvatarEditor } from "@/features/auth/components/AvatarEditor";
import { selectCurrentUser } from "@/features/auth/slice/authSlice";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { makeUser } from "@/mocks/fixtures/user";
import { signedInAuth } from "@/test/authState";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { renderPage } from "@/test/pageHarness";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const server = setupMockServer();
const avatarUrl = apiUrl("/me/avatar");
const SAVED = { publicId: "samarth-ai/test/avatars/saved", version: 2 };

/* The remove confirmation lives in the photo card, so it is exercised through the card. */
function EditorHarness() {
    const user = useAppSelector(selectCurrentUser);
    return <AvatarEditor user={user} />;
}

beforeEach(() => {
    vi.mocked(toast.success).mockClear();
});

function renderEditor(userOverrides = {}) {
    return renderPage(EditorHarness, {
        path: "/settings/profile",
        preloadedState: { auth: signedInAuth(userOverrides) },
    });
}

describe("AvatarRemoveDialog (remove photo)", () => {
    it("asks first, and a cancel changes nothing", async () => {
        let deletes = 0;
        server.use(
            http.delete(avatarUrl, () => {
                deletes += 1;
                return okResponse({ user: makeUser({ avatar: null }) });
            })
        );
        const user = userEvent.setup();
        renderEditor({ avatar: SAVED });
        await user.click(screen.getByRole("button", { name: "Remove photo" }));
        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByText("Remove your photo?")).toBeVisible();
        await user.click(
            within(dialog).getByRole("button", { name: "Cancel" })
        );
        await waitFor(() =>
            expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
        );
        expect(deletes).toBe(0);
    });

    it("removes the photo after confirming and falls back to initials", async () => {
        const user = userEvent.setup();
        const { store } = renderEditor({ avatar: SAVED });
        await user.click(screen.getByRole("button", { name: "Remove photo" }));
        await user.click(
            within(await screen.findByRole("alertdialog")).getByRole("button", {
                name: "Remove photo",
            })
        );
        expect(await screen.findByText("Photo removed.")).toBeVisible();
        expect(store.getState().auth.user.avatar).toBeNull();
        expect(toast.success).toHaveBeenCalledWith(
            "Photo removed.",
            expect.objectContaining({ id: "avatar-removed" })
        );
        expect(
            screen.queryByRole("button", { name: "Remove photo" })
        ).not.toBeInTheDocument();
        expect(screen.getByText("AV")).toBeInTheDocument();
    });

    it("keeps the photo and explains when the server refuses", async () => {
        server.use(
            http.delete(avatarUrl, () => errorResponse(500, "INTERNAL"))
        );
        const user = userEvent.setup();
        const { store } = renderEditor({ avatar: SAVED });
        await user.click(screen.getByRole("button", { name: "Remove photo" }));
        await user.click(
            within(await screen.findByRole("alertdialog")).getByRole("button", {
                name: "Remove photo",
            })
        );
        expect(await screen.findByRole("alert")).toHaveTextContent(
            /Something went wrong on our side/
        );
        expect(store.getState().auth.user.avatar).toEqual(SAVED);
    });
});
