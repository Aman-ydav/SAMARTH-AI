import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmailChangeSection } from "@/features/auth/components/EmailChangeSection";
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

const server = setupMockServer();
const changeUrl = apiUrl("/auth/change-email");

beforeEach(() => {
    Object.assign(mocks.env, {
        googleEnabled: true,
        googleClientId: "client-id.example.test",
    });
});
afterEach(async () => {
    await i18n.changeLanguage("en");
});

function track(response = () => okResponse(null, { status: 202 })) {
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
    screen.getByRole("button", { name: "Send confirmation link" });

describe("EmailChangeSection with a password", () => {
    it("shows the current email as verified and a labelled form", async () => {
        const { container } = renderWithUser(EmailChangeSection);
        expect(
            screen.getByRole("heading", { level: 2, name: "Email address" })
        ).toBeVisible();
        expect(screen.getByText("asha.verma@example.test")).toBeVisible();
        expect(screen.getByText("Verified")).toBeVisible();
        expect(field("New email address")).toHaveAttribute("type", "email");
        expect(field("New email address")).toHaveAttribute(
            "autocomplete",
            "email"
        );
        await expectAccessible(container);
    });

    it("does not claim verification for an unverified email", () => {
        renderWithUser(EmailChangeSection, { user: { emailVerified: false } });
        expect(screen.queryByText("Verified")).not.toBeInTheDocument();
    });

    it("blocks bad input without a request", async () => {
        const bodies = track();
        const user = userEvent.setup();
        renderWithUser(EmailChangeSection);
        await user.click(submitButton());
        expect(
            await screen.findByText("Enter your email address.")
        ).toBeVisible();
        await fill(user, "New email address", "not-an-email");
        await user.click(submitButton());
        expect(
            await screen.findByText("Enter a valid email address.")
        ).toBeVisible();
        expect(bodies).toEqual([]);
    });

    it("refuses the address the account already uses, whatever the case", async () => {
        const bodies = track();
        const user = userEvent.setup();
        renderWithUser(EmailChangeSection);
        await fill(user, "New email address", "ASHA.Verma@example.test");
        await fill(user, "Current password", "old password 1");
        await user.click(submitButton());
        expect(
            await screen.findByText("This is already your email address.")
        ).toBeVisible();
        expect(bodies).toEqual([]);
    });

    it("sends the normalised address with the password and shows the neutral confirmation", async () => {
        const bodies = track();
        const user = userEvent.setup();
        const { store } = renderWithUser(EmailChangeSection);
        await fill(user, "New email address", "  New.Address@Example.test ");
        await fill(user, "Current password", "old password 1");
        await user.click(submitButton());
        const status = await screen.findByText(
            /If new.address@example.test can be used/
        );
        expect(status).toHaveTextContent(
            "Your email changes only after you open that link"
        );
        expect(status).toHaveTextContent("undo the change for 24 hours");
        expect(bodies).toEqual([
            {
                newEmail: "new.address@example.test",
                currentPassword: "old password 1",
            },
        ]);
        expect(field("New email address")).toHaveValue("");
        expect(store.getState().auth.user.email).toBe(
            "asha.verma@example.test"
        );
        expect(JSON.stringify(store.getState())).not.toContain(
            "old password 1"
        );
    });

    it("sends one request for a double click", async () => {
        const bodies = track();
        const user = userEvent.setup();
        renderWithUser(EmailChangeSection);
        await fill(user, "New email address", "new@example.test");
        await fill(user, "Current password", "old password 1");
        await user.dblClick(submitButton());
        await screen.findByText(/can be used/);
        expect(bodies).toHaveLength(1);
    });

    it("puts a wrong password on the password field", async () => {
        track(() => errorResponse(401, "INVALID_CREDENTIALS"));
        const user = userEvent.setup();
        renderWithUser(EmailChangeSection);
        await fill(user, "New email address", "new@example.test");
        await fill(user, "Current password", "wrong password");
        await user.click(submitButton());
        expect(
            await screen.findByText("Invalid email or password.")
        ).toBeVisible();
        expect(field("Current password")).toHaveAttribute(
            "aria-invalid",
            "true"
        );
        expect(field("New email address")).toHaveValue("new@example.test");
    });

    it("explains a refused email domain on the address field", async () => {
        track(() => errorResponse(403, "DOMAIN_NOT_ALLOWED"));
        const user = userEvent.setup();
        renderWithUser(EmailChangeSection);
        await fill(user, "New email address", "me@blocked.test");
        await fill(user, "Current password", "old password 1");
        await user.click(submitButton());
        expect(
            await screen.findByText("This email domain is not allowed.")
        ).toBeVisible();
        expect(field("New email address")).toHaveAttribute(
            "aria-invalid",
            "true"
        );
    });

    it("counts down a rate limit", async () => {
        track(() =>
            errorResponse(429, "RATE_LIMITED", {
                headers: { "Retry-After": "120" },
            })
        );
        const user = userEvent.setup();
        renderWithUser(EmailChangeSection);
        await fill(user, "New email address", "new@example.test");
        await fill(user, "Current password", "old password 1");
        await user.click(submitButton());
        expect(await screen.findByText(/You can try again in/)).toBeVisible();
        expect(submitButton()).toBeDisabled();
    });
});

describe("EmailChangeSection for a Google-only account", () => {
    const googleOnly = { hasPassword: false, authProviders: ["google"] };

    it("needs Google confirmation before the button works, then sends the credential", async () => {
        const bodies = track();
        const user = userEvent.setup();
        renderWithUser(EmailChangeSection, { user: googleOnly });
        expect(
            screen.queryByLabelText("Current password")
        ).not.toBeInTheDocument();
        await fill(user, "New email address", "new@example.test");
        expect(submitButton()).toBeDisabled();
        await user.click(
            screen.getByRole("button", { name: "fake google ok" })
        );
        expect(submitButton()).toBeEnabled();
        await user.click(submitButton());
        await screen.findByText(/can be used/);
        expect(bodies).toEqual([
            { newEmail: "new@example.test", credential: fakeGoogle.credential },
        ]);
    });

    it("shows a retryable warning when Google fails to complete", async () => {
        const user = userEvent.setup();
        renderWithUser(EmailChangeSection, { user: googleOnly });
        await user.click(
            screen.getByRole("button", { name: "fake google error" })
        );
        expect(
            await screen.findByText(
                /Google sign-in was cancelled or did not complete/
            )
        ).toBeVisible();
        await user.click(
            screen.getByRole("button", { name: "Try Google sign-in again" })
        );
        expect(
            screen.queryByText(/Google sign-in was cancelled/)
        ).not.toBeInTheDocument();
    });
});

describe("EmailChangeSection Hindi", () => {
    it("renders in Hindi without accessibility violations", async () => {
        await i18n.changeLanguage("hi");
        const { container } = renderWithUser(EmailChangeSection);
        expect(screen.getByLabelText("नया ईमेल पता")).toBeVisible();
        expect(
            screen.getByRole("button", { name: "पुष्टि का लिंक भेजें" })
        ).toBeEnabled();
        await expectAccessible(container);
    });
});
