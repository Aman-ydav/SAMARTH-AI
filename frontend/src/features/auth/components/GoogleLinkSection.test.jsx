import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleLinkSection } from "@/features/auth/components/GoogleLinkSection";
import { i18n } from "@/i18n";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { makeSessionData, makeUser } from "@/mocks/fixtures/user";
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
const googleUrl = apiUrl("/auth/google");
const linkedUser = { authProviders: ["password", "google"] };

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

function track(method, response) {
    const bodies = [];
    server.use(
        http[method](googleUrl, async ({ request }) => {
            bodies.push(await request.json());
            return response();
        })
    );
    return bodies;
}

describe("GoogleLinkSection when Google is not linked", () => {
    it("names the expected email and offers the Google button", async () => {
        const { container } = renderWithUser(GoogleLinkSection);
        expect(
            screen.getByRole("heading", { level: 2, name: "Google sign-in" })
        ).toBeVisible();
        expect(screen.getByText("Not linked")).toBeVisible();
        expect(
            screen.getByText(
                /Choose the Google account that uses asha.verma@example.test/
            )
        ).toBeVisible();
        expect(
            screen.queryByRole("button", { name: "Unlink Google" })
        ).not.toBeInTheDocument();
        await expectAccessible(container);
    });

    it("links when the Google account belongs to this account", async () => {
        const bodies = track("post", () =>
            okResponse(
                makeSessionData({}, { authProviders: ["password", "google"] })
            )
        );
        const user = userEvent.setup();
        const { store } = renderWithUser(GoogleLinkSection);
        await user.click(
            screen.getByRole("button", { name: "fake google ok" })
        );
        expect(
            await screen.findByText("Google is now linked to your account.")
        ).toBeVisible();
        expect(bodies).toEqual([{ credential: fakeGoogle.credential }]);
        expect(store.getState().auth.user.authProviders).toContain("google");
        expect(screen.getByText("Linked")).toBeVisible();
        expect(
            screen.getByRole("button", { name: "Unlink Google" })
        ).toBeEnabled();
        expect(JSON.stringify(store.getState())).not.toContain(
            fakeGoogle.credential
        );
    });

    it("says so plainly when the Google account signed the person in as someone else", async () => {
        track("post", () =>
            okResponse(
                makeSessionData(
                    {},
                    {
                        id: "64b7f0c2a1b2c3d4e5f6bbbb",
                        email: "other@example.test",
                        authProviders: ["google"],
                    }
                )
            )
        );
        const user = userEvent.setup();
        const { store } = renderWithUser(GoogleLinkSection);
        await user.click(
            screen.getByRole("button", { name: "fake google ok" })
        );
        expect(
            await screen.findByText(/belongs to a different SAMARTH AI account/)
        ).toBeVisible();
        expect(store.getState().auth.user.email).toBe("other@example.test");
    });

    it("shows a refusal from the server and stays unlinked", async () => {
        track("post", () => errorResponse(401, "GOOGLE_TOKEN_INVALID"));
        const user = userEvent.setup();
        const { store } = renderWithUser(GoogleLinkSection);
        await user.click(
            screen.getByRole("button", { name: "fake google ok" })
        );
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Google sign-in failed. Please try again."
        );
        expect(store.getState().auth.user.authProviders).not.toContain(
            "google"
        );
        expect(screen.getByText("Not linked")).toBeVisible();
    });

    it("renders nothing when Google sign-in is not configured", () => {
        mocks.env.googleEnabled = false;
        const { container } = renderWithUser(GoogleLinkSection);
        expect(
            screen.queryByRole("heading", { name: "Google sign-in" })
        ).not.toBeInTheDocument();
        expect(container.querySelector("section")).toBeNull();
    });
});

describe("GoogleLinkSection when Google is linked", () => {
    it("opens a confirm dialog and does nothing when cancelled", async () => {
        const bodies = track("delete", () => okResponse({ user: makeUser() }));
        const user = userEvent.setup();
        renderWithUser(GoogleLinkSection, { user: linkedUser });
        expect(screen.getByText("Linked")).toBeVisible();
        await user.click(screen.getByRole("button", { name: "Unlink Google" }));
        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByText("Unlink Google?")).toBeVisible();
        await user.click(
            within(dialog).getByRole("button", { name: "Cancel" })
        );
        await waitFor(() =>
            expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
        );
        expect(bodies).toEqual([]);
    });

    it("unlinks with a fresh Google credential, closes the dialog and confirms", async () => {
        const bodies = track("delete", () =>
            okResponse({ user: makeUser({ authProviders: ["password"] }) })
        );
        const user = userEvent.setup();
        const { store } = renderWithUser(GoogleLinkSection, {
            user: linkedUser,
        });
        await user.click(screen.getByRole("button", { name: "Unlink Google" }));
        await user.click(
            within(await screen.findByRole("alertdialog")).getByRole("button", {
                name: "fake google ok",
            })
        );
        await waitFor(() =>
            expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
        );
        expect(bodies).toEqual([{ credential: fakeGoogle.credential }]);
        expect(store.getState().auth.user.authProviders).toEqual(["password"]);
        expect(await screen.findByText("Not linked")).toBeVisible();
        expect(toast.success).toHaveBeenCalledWith(
            "Google is unlinked.",
            expect.objectContaining({ id: "google-unlinked" })
        );
    });

    it("shows AUTH_METHOD_REQUIRED inside the dialog when the server refuses", async () => {
        track("delete", () => errorResponse(409, "AUTH_METHOD_REQUIRED"));
        const user = userEvent.setup();
        const { store } = renderWithUser(GoogleLinkSection, {
            user: linkedUser,
        });
        await user.click(screen.getByRole("button", { name: "Unlink Google" }));
        const dialog = await screen.findByRole("alertdialog");
        await user.click(
            within(dialog).getByRole("button", { name: "fake google ok" })
        );
        expect(await within(dialog).findByRole("alert")).toHaveTextContent(
            "You cannot remove your only way to sign in."
        );
        expect(store.getState().auth.user.authProviders).toContain("google");
    });

    it("explains a wrong Google account (REAUTH_REQUIRED) and clears the error on close", async () => {
        track("delete", () => errorResponse(403, "REAUTH_REQUIRED"));
        const user = userEvent.setup();
        renderWithUser(GoogleLinkSection, { user: linkedUser });
        await user.click(screen.getByRole("button", { name: "Unlink Google" }));
        let dialog = await screen.findByRole("alertdialog");
        await user.click(
            within(dialog).getByRole("button", { name: "fake google ok" })
        );
        expect(await within(dialog).findByRole("alert")).toHaveTextContent(
            "Please confirm your identity to continue."
        );
        await user.click(
            within(dialog).getByRole("button", { name: "Cancel" })
        );
        await waitFor(() =>
            expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
        );
        await user.click(screen.getByRole("button", { name: "Unlink Google" }));
        dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    });

    it("blocks unlinking when Google is the only way to log in", () => {
        renderWithUser(GoogleLinkSection, {
            user: { ...linkedUser, hasPassword: false },
        });
        expect(
            screen.getByText(/Google is your only way to log in/)
        ).toBeVisible();
        expect(
            screen.getByRole("button", { name: "Unlink Google" })
        ).toBeDisabled();
    });

    it("keeps the status visible but cannot unlink when Google is not configured", () => {
        mocks.env.googleEnabled = false;
        renderWithUser(GoogleLinkSection, { user: linkedUser });
        expect(screen.getByText("Linked")).toBeVisible();
        expect(
            screen.getByRole("button", { name: "Unlink Google" })
        ).toBeDisabled();
    });
});

describe("GoogleLinkSection Hindi", () => {
    it("renders in Hindi without accessibility violations", async () => {
        await i18n.changeLanguage("hi");
        const { container } = renderWithUser(GoogleLinkSection, {
            user: linkedUser,
        });
        expect(screen.getByText("जुड़ा हुआ")).toBeVisible();
        expect(
            screen.getByRole("button", { name: "Google हटाएँ" })
        ).toBeEnabled();
        await expectAccessible(container);
    });
});
