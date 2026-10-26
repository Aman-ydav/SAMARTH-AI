import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ChangePasswordPage from "@/features/auth/pages/ChangePasswordPage";
import { i18n } from "@/i18n";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { makeUser } from "@/mocks/fixtures/user";
import { signedInAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { setMotionTier } from "@/test/motionTier";
import { renderAuthPage, where } from "@/test/renderAuthPage";

const server = setupMockServer();
const changeUrl = apiUrl("/auth/change-password");
const OLD = "temporary-Pass-1";
const NEW = "mango river lantern 42";

beforeEach(() => setMotionTier("reduced"));
afterEach(async () => {
    await i18n.changeLanguage("en");
});

const renderChange = (userOverrides = { mustChangePassword: true }) =>
    renderAuthPage(<ChangePasswordPage />, {
        path: "/change-password",
        preloadedState: { auth: signedInAuth(userOverrides) },
    });

const field = (label) => screen.getByLabelText(label, { selector: "input" });

async function fill(user, { current = OLD, next = NEW, confirm = next } = {}) {
    for (const [label, value] of [
        ["Current password", current],
        ["New password", next],
        ["Confirm password", confirm],
    ]) {
        if (!value) continue;
        await user.click(field(label));
        await user.paste(value);
    }
    await user.click(screen.getByRole("button", { name: /Set new password/ }));
}

describe("ChangePasswordPage", () => {
    it("explains the forced change, the sign-out of other devices, and uses the right autocomplete values", async () => {
        const { container } = renderChange();
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "Change your password",
            })
        ).toBeInTheDocument();
        expect(
            screen.getByText(/signs you out of all your other devices/)
        ).toBeInTheDocument();
        expect(field("Current password")).toHaveAttribute(
            "autocomplete",
            "current-password"
        );
        expect(field("New password")).toHaveAttribute(
            "autocomplete",
            "new-password"
        );
        expect(screen.getByText("0 of 72 bytes used")).toBeInTheDocument();
        await expectAccessible(container);
    });

    it("requires all three fields and a matching confirmation", async () => {
        const bodies = [];
        server.use(
            http.post(changeUrl, async ({ request }) => {
                bodies.push(await request.clone().json());
                return okResponse({ user: makeUser() });
            })
        );
        const user = userEvent.setup();
        renderChange();
        await user.click(
            screen.getByRole("button", { name: /Set new password/ })
        );
        const summary = await screen.findByRole("group", {
            name: /problems with your entry/,
        });
        await waitFor(() => expect(summary).toHaveFocus());
        await fill(user, { confirm: `${NEW}!` });
        expect(
            (await screen.findAllByText("The passwords do not match.")).length
        ).toBeGreaterThan(0);
        expect(bodies).toHaveLength(0);
    });

    it("rejects a new password equal to the current one", async () => {
        const user = userEvent.setup();
        renderChange();
        await fill(user, { current: NEW, next: NEW });
        expect(
            (
                await screen.findAllByText(
                    /must be different from the current one/
                )
            ).length
        ).toBeGreaterThan(0);
    });

    it("posts only the two passwords, confirms the change and continues to the dashboard", async () => {
        const bodies = [];
        server.use(
            http.post(changeUrl, async ({ request }) => {
                bodies.push(await request.clone().json());
                return okResponse({
                    user: makeUser({ mustChangePassword: false }),
                });
            })
        );
        const user = userEvent.setup();
        const { router, store } = renderChange();
        await fill(user);
        const title = await screen.findByRole("heading", {
            name: "Password changed",
        });
        await waitFor(() => expect(title).toHaveFocus());
        expect(bodies).toEqual([{ currentPassword: OLD, newPassword: NEW }]);
        expect(store.getState().auth.user.mustChangePassword).toBe(false);
        await user.click(screen.getByRole("button", { name: "Continue" }));
        await waitFor(() => expect(where(router)).toBe("/dashboard"));
    });

    it("maps a wrong current password onto that field without leaking more", async () => {
        server.use(
            http.post(changeUrl, () =>
                errorResponse(401, "INVALID_CREDENTIALS")
            )
        );
        const user = userEvent.setup();
        renderChange();
        await fill(user);
        expect(
            await screen.findByText("Invalid email or password.")
        ).toBeInTheDocument();
        await waitFor(() => expect(field("Current password")).toHaveFocus());
    });

    it.each([
        ["PASSWORD_POLICY", "This password does not meet the requirements."],
        ["PASSWORD_REUSED", "Choose a password you have not used recently."],
    ])("maps %s onto the new password field", async (code, text) => {
        server.use(http.post(changeUrl, () => errorResponse(400, code)));
        const user = userEvent.setup();
        renderChange();
        await fill(user);
        expect(await screen.findByText(text)).toBeInTheDocument();
        await waitFor(() => expect(field("New password")).toHaveFocus());
    });

    it("shows REAUTH_REQUIRED as a form message", async () => {
        server.use(
            http.post(changeUrl, () => errorResponse(403, "REAUTH_REQUIRED"))
        );
        const user = userEvent.setup();
        renderChange();
        await fill(user);
        expect(
            await screen.findByText("Please confirm your identity to continue.")
        ).toBeInTheDocument();
    });

    it("offers log out as the secondary action", async () => {
        const user = userEvent.setup();
        const { router } = renderChange();
        await user.click(screen.getByRole("button", { name: "Log out" }));
        await waitFor(() => expect(where(router)).toBe("/login"));
    });

    it("renders in Hindi", async () => {
        await i18n.changeLanguage("hi");
        const { container } = renderChange();
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "अपना पासवर्ड बदलें",
            })
        ).toBeInTheDocument();
        await expectAccessible(container);
    });
});
