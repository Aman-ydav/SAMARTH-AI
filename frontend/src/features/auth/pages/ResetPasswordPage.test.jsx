import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ResetPasswordPage from "@/features/auth/pages/ResetPasswordPage";
import { i18n } from "@/i18n";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { anonymousAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { setMotionTier } from "@/test/motionTier";
import { renderAuthPage, where } from "@/test/renderAuthPage";

const server = setupMockServer();
const validateUrl = apiUrl("/auth/reset-password/validate");
const resetUrl = apiUrl("/auth/reset-password");
const TOKEN = "tok-reset-0123456789";
const STRONG = "mango river lantern 42";

beforeEach(() => setMotionTier("reduced"));
afterEach(async () => {
    window.history.replaceState(null, "", "/");
    await i18n.changeLanguage("en");
});

function track() {
    const calls = { validate: [], reset: [] };
    server.use(
        http.post(validateUrl, async ({ request }) => {
            calls.validate.push(await request.clone().json());
            return okResponse({ valid: true });
        }),
        http.post(resetUrl, async ({ request }) => {
            calls.reset.push(await request.clone().json());
            return okResponse(null);
        })
    );
    return calls;
}

function renderReset(hash = `#token=${TOKEN}`) {
    window.history.replaceState(null, "", `/reset-password${hash}`);
    return renderAuthPage(<ResetPasswordPage />, {
        path: "/reset-password",
        entry: `/reset-password${hash}`,
        preloadedState: { auth: anonymousAuth },
    });
}

const newPassword = () =>
    screen.getByLabelText("New password", { selector: "input" });
const confirm = () =>
    screen.getByLabelText("Confirm password", { selector: "input" });

async function fillAndSubmit(user, password = STRONG, again = password) {
    await user.click(
        await screen.findByLabelText("New password", { selector: "input" })
    );
    await user.paste(password);
    await user.click(confirm());
    await user.paste(again);
    await user.click(screen.getByRole("button", { name: "Update password" }));
}

describe("ResetPasswordPage token handling", () => {
    it("reads the fragment token once, strips it from the address bar and validates without consuming", async () => {
        const calls = track();
        renderReset();
        expect(
            await screen.findByLabelText("New password", { selector: "input" })
        ).toBeInTheDocument();
        expect(window.location.hash).toBe("");
        expect(calls.validate).toEqual([{ token: TOKEN }]);
        expect(calls.reset).toHaveLength(0);
    });

    it("keeps the token out of Redux", async () => {
        track();
        const { store } = renderReset();
        await screen.findByLabelText("New password", { selector: "input" });
        expect(JSON.stringify(store.getState())).not.toContain(TOKEN);
    });

    it("shows the generic invalid screen without any request when the link has no token", async () => {
        const calls = track();
        const { container } = renderReset("");
        expect(
            await screen.findByRole("heading", {
                level: 1,
                name: "Reset link invalid",
            })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Request new link" })
        ).toHaveAttribute("href", "/forgot-password");
        expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
            "href",
            "/login"
        );
        expect(calls.validate).toHaveLength(0);
        await expectAccessible(container);
    });

    it("shows the same invalid screen for an expired, used or unknown token", async () => {
        server.use(
            http.post(validateUrl, () =>
                errorResponse(400, "RESET_TOKEN_INVALID")
            )
        );
        renderReset();
        expect(
            await screen.findByRole("heading", { name: "Reset link invalid" })
        ).toBeInTheDocument();
        expect(document.title).toBe("Reset link invalid | SAMARTH AI");
        expect(
            screen.getByText(/invalid, expired or already used/)
        ).toBeInTheDocument();
    });

    it("offers a retry instead of the invalid screen when the check itself fails", async () => {
        server.use(http.post(validateUrl, () => Response.error()));
        const user = userEvent.setup();
        renderReset();
        expect(
            await screen.findByText(/could not reach the server/)
        ).toBeInTheDocument();
        server.use(http.post(validateUrl, () => okResponse({ valid: true })));
        await user.click(screen.getByRole("button", { name: "Try again" }));
        expect(
            await screen.findByLabelText("New password", { selector: "input" })
        ).toBeInTheDocument();
    });
});

describe("ResetPasswordPage form", () => {
    it("validates the new password and the confirmation before posting", async () => {
        const calls = track();
        const user = userEvent.setup();
        renderReset();
        await fillAndSubmit(user, "short", "other");
        expect(
            await screen.findByText("Use at least 10 characters.")
        ).toBeInTheDocument();
        expect(calls.reset).toHaveLength(0);
    });

    it("rejects a mismatched confirmation", async () => {
        const calls = track();
        const user = userEvent.setup();
        renderReset();
        await fillAndSubmit(user, STRONG, `${STRONG}!`);
        expect(
            await screen.findByText("The passwords do not match.")
        ).toBeInTheDocument();
        expect(calls.reset).toHaveLength(0);
    });

    it("counts bytes: 25 Devanagari letters are rejected", async () => {
        const calls = track();
        const user = userEvent.setup();
        renderReset();
        await fillAndSubmit(user, "क".repeat(25));
        expect(
            await screen.findByText(/Use at most 72 bytes/)
        ).toBeInTheDocument();
        expect(calls.reset).toHaveLength(0);
    });

    it("posts the token and password, then goes to /login with a notice and no session", async () => {
        const calls = track();
        const user = userEvent.setup();
        const { router, store } = renderReset();
        await fillAndSubmit(user);
        await waitFor(() => expect(where(router)).toBe("/login"));
        expect(calls.reset).toEqual([{ token: TOKEN, newPassword: STRONG }]);
        expect(router.state.location.state).toEqual({
            notice: "passwordReset",
        });
        expect(store.getState().auth.user).toBeNull();
    });

    it("sends the person to the invalid screen when the token dies before the submit", async () => {
        track();
        server.use(
            http.post(resetUrl, () => errorResponse(400, "RESET_TOKEN_INVALID"))
        );
        const user = userEvent.setup();
        renderReset();
        await fillAndSubmit(user);
        expect(
            await screen.findByRole("heading", { name: "Reset link invalid" })
        ).toBeInTheDocument();
    });

    it.each([
        ["PASSWORD_POLICY", "This password does not meet the requirements."],
        ["PASSWORD_REUSED", "Choose a password you have not used recently."],
    ])("maps %s onto the new password field", async (code, text) => {
        track();
        server.use(http.post(resetUrl, () => errorResponse(400, code)));
        const user = userEvent.setup();
        renderReset();
        await fillAndSubmit(user);
        expect(await screen.findByText(text)).toBeInTheDocument();
        await waitFor(() => expect(newPassword()).toHaveFocus());
        expect(newPassword()).toHaveValue(STRONG);
    });

    it("has no accessibility violations on the form and renders in Hindi", async () => {
        track();
        await i18n.changeLanguage("hi");
        const { container } = renderReset();
        expect(
            await screen.findByRole("heading", {
                level: 1,
                name: "नया पासवर्ड सेट करें",
            })
        ).toBeInTheDocument();
        await expectAccessible(container);
    }, 15000);
});
