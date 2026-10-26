import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PasswordSection } from "@/features/auth/components/PasswordSection";
import { i18n } from "@/i18n";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { makeUser } from "@/mocks/fixtures/user";
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

const server = setupMockServer();
const changeUrl = apiUrl("/auth/change-password");
const GOOD = "a long enough passphrase";

beforeEach(() => {
    Object.assign(mocks.env, {
        googleEnabled: true,
        googleClientId: "client-id.example.test",
    });
});
afterEach(async () => {
    await i18n.changeLanguage("en");
});

function track(response = () => okResponse({ user: makeUser() })) {
    const bodies = [];
    server.use(
        http.post(changeUrl, async ({ request }) => {
            bodies.push(await request.json());
            return response();
        })
    );
    return bodies;
}

const field = (name) => screen.getByLabelText(name);
async function fill(user, label, value) {
    await user.click(field(label));
    await user.paste(value);
}
const submitButton = () =>
    screen.getByRole("button", { name: "Change password" });

async function fillValid(user, { current = "old password 1" } = {}) {
    await fill(user, "Current password", current);
    await fill(user, "New password", GOOD);
    await fill(user, "Confirm password", GOOD);
}

describe("PasswordSection with a password", () => {
    it("explains the effect on other devices and shows the policy checklist", async () => {
        const { container } = renderWithUser(PasswordSection);
        expect(
            screen.getByRole("heading", { level: 2, name: "Password" })
        ).toBeVisible();
        expect(
            screen.getByText(/logs you out of your other devices/)
        ).toBeVisible();
        expect(screen.getByText("Your password needs")).toBeVisible();
        await expectAccessible(container);
    });

    it("blocks an empty submit with messages and sends nothing", async () => {
        const bodies = track();
        const user = userEvent.setup();
        renderWithUser(PasswordSection);
        await user.click(submitButton());
        expect(
            await screen.findAllByText("Enter your password.")
        ).not.toHaveLength(0);
        expect(bodies).toEqual([]);
    });

    it("rejects a mismatched confirmation and an unchanged password", async () => {
        const bodies = track();
        const user = userEvent.setup();
        renderWithUser(PasswordSection);
        await fill(user, "Current password", GOOD);
        await fill(user, "New password", GOOD);
        await fill(user, "Confirm password", "something else entirely");
        await user.click(submitButton());
        expect(
            await screen.findByText("The passwords do not match.")
        ).toBeVisible();
        expect(
            screen.getByText(
                "The new password must be different from the current one."
            )
        ).toBeVisible();
        expect(bodies).toEqual([]);
    });

    it("changes the password, sends no confirm field, clears the form and confirms", async () => {
        const bodies = track();
        const user = userEvent.setup();
        const { store } = renderWithUser(PasswordSection);
        await fillValid(user);
        await user.click(submitButton());
        expect(
            await screen.findByText(
                "Password changed. Your other devices were logged out."
            )
        ).toBeVisible();
        expect(bodies).toEqual([
            { currentPassword: "old password 1", newPassword: GOOD },
        ]);
        expect(field("Current password")).toHaveValue("");
        expect(field("New password")).toHaveValue("");
        expect(store.getState().auth.user).not.toBeNull();
        expect(JSON.stringify(store.getState())).not.toContain(GOOD);
    });

    it("sends one request for a double click", async () => {
        const bodies = track();
        const user = userEvent.setup();
        renderWithUser(PasswordSection);
        await fillValid(user);
        await user.dblClick(submitButton());
        await screen.findByText(/Password changed/);
        expect(bodies).toHaveLength(1);
    });

    it("puts a wrong current password on its field and keeps the input", async () => {
        track(() => errorResponse(401, "INVALID_CREDENTIALS"));
        const user = userEvent.setup();
        renderWithUser(PasswordSection);
        await fillValid(user);
        await user.click(submitButton());
        expect(
            await screen.findByText("Invalid email or password.")
        ).toBeVisible();
        expect(field("Current password")).toHaveAttribute(
            "aria-invalid",
            "true"
        );
        expect(field("New password")).toHaveValue(GOOD);
    });

    it.each(["PASSWORD_POLICY", "PASSWORD_REUSED"])(
        "puts %s on the new password field",
        async (code) => {
            track(() => errorResponse(400, code));
            const user = userEvent.setup();
            renderWithUser(PasswordSection);
            await fillValid(user);
            await user.click(submitButton());
            await waitFor(() =>
                expect(field("New password")).toHaveAttribute(
                    "aria-invalid",
                    "true"
                )
            );
        }
    );

    it("shows a form-level alert for a server failure", async () => {
        track(() => errorResponse(500, "INTERNAL", { requestId: "req-pw" }));
        const user = userEvent.setup();
        renderWithUser(PasswordSection);
        await fillValid(user);
        await user.click(submitButton());
        expect(await screen.findByRole("alert")).toHaveTextContent(
            /Something went wrong on our side/
        );
        expect(screen.getByText(/req-pw/)).toBeVisible();
    });

    it("counts down a rate limit and disables the button", async () => {
        track(() =>
            errorResponse(429, "RATE_LIMITED", {
                headers: { "Retry-After": "60" },
            })
        );
        const user = userEvent.setup();
        renderWithUser(PasswordSection);
        await fillValid(user);
        await user.click(submitButton());
        expect(await screen.findByText(/You can try again in/)).toBeVisible();
        expect(submitButton()).toBeDisabled();
    });
});

describe("PasswordSection for a Google-only account", () => {
    const googleOnly = { hasPassword: false, authProviders: ["google"] };

    it("asks for Google confirmation instead of a current password and waits for it", async () => {
        const { container } = renderWithUser(PasswordSection, {
            user: googleOnly,
        });
        expect(
            screen.getByRole("heading", { level: 2, name: "Add a password" })
        ).toBeVisible();
        expect(
            screen.queryByLabelText("Current password")
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Set password" })
        ).toBeDisabled();
        expect(
            screen.getByText(/Confirm with Google before you continue/)
        ).toBeVisible();
        await expectAccessible(container);
    });

    it("sets the first password with the Google credential", async () => {
        const bodies = track(() =>
            okResponse({ user: makeUser({ hasPassword: true }) })
        );
        const user = userEvent.setup();
        const { store } = renderWithUser(PasswordSection, { user: googleOnly });
        await user.click(
            screen.getByRole("button", { name: "fake google ok" })
        );
        expect(await screen.findByText("Confirmed with Google.")).toBeVisible();
        await fill(user, "New password", GOOD);
        await fill(user, "Confirm password", GOOD);
        await user.click(screen.getByRole("button", { name: "Set password" }));
        expect(
            await screen.findByText(
                "Password set. Your other devices were logged out."
            )
        ).toBeVisible();
        expect(bodies).toEqual([
            { credential: fakeGoogle.credential, newPassword: GOOD },
        ]);
        expect(store.getState().auth.user.hasPassword).toBe(true);
        expect(JSON.stringify(store.getState())).not.toContain(
            fakeGoogle.credential
        );
    });

    it("drops the confirmation when the server says it is not the linked account", async () => {
        track(() => errorResponse(403, "REAUTH_REQUIRED"));
        const user = userEvent.setup();
        renderWithUser(PasswordSection, { user: googleOnly });
        await user.click(
            screen.getByRole("button", { name: "fake google ok" })
        );
        await fill(user, "New password", GOOD);
        await fill(user, "Confirm password", GOOD);
        await user.click(screen.getByRole("button", { name: "Set password" }));
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Please confirm your identity to continue."
        );
        expect(
            screen.queryByText("Confirmed with Google.")
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "fake google ok" })
        ).toBeVisible();
    });

    it("lets the person confirm again", async () => {
        const user = userEvent.setup();
        renderWithUser(PasswordSection, { user: googleOnly });
        await user.click(
            screen.getByRole("button", { name: "fake google ok" })
        );
        await user.click(screen.getByRole("button", { name: "Confirm again" }));
        expect(
            screen.getByRole("button", { name: "fake google ok" })
        ).toBeVisible();
    });

    it("says the change is impossible when Google sign-in is not configured", () => {
        mocks.env.googleEnabled = false;
        renderWithUser(PasswordSection, { user: googleOnly });
        expect(
            screen.getByText(/Google confirmation is not available here/)
        ).toBeVisible();
        expect(
            screen.getByRole("button", { name: "Set password" })
        ).toBeDisabled();
    });
});

describe("PasswordSection Hindi", () => {
    it("renders in Hindi without accessibility violations", async () => {
        await i18n.changeLanguage("hi");
        const { container } = renderWithUser(PasswordSection);
        expect(
            screen.getByRole("heading", { level: 2, name: "पासवर्ड" })
        ).toBeVisible();
        expect(
            screen.getByRole("button", { name: "पासवर्ड बदलें" })
        ).toBeEnabled();
        await expectAccessible(container);
    });
});
