import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignupForm } from "@/features/auth/components/SignupForm";
import { selectPendingEmail } from "@/features/auth";
import { i18n } from "@/i18n";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { anonymousAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { setMotionTier } from "@/test/motionTier";
import { renderAuthPage, where } from "@/test/renderAuthPage";

vi.mock("@/lib/env", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        env: { ...actual.env, googleEnabled: false, googleClientId: "" },
    };
});

const server = setupMockServer();
const registerUrl = apiUrl("/auth/register");
const STRONG = "mango river lantern 42";

beforeEach(() => setMotionTier("reduced"));
afterEach(async () => {
    await i18n.changeLanguage("en");
});

function renderSignup(options = {}) {
    return renderAuthPage(<SignupForm {...options.props} />, {
        path: "/signup",
        preloadedState: { auth: anonymousAuth },
        ...options,
    });
}

function captureRegister(response = () => okResponse(null, { status: 202 })) {
    const bodies = [];
    server.use(
        http.post(registerUrl, async ({ request }) => {
            bodies.push(await request.clone().json());
            return response();
        })
    );
    return bodies;
}

const field = (name) => screen.getByLabelText(name, { selector: "input" });
const submitButton = () =>
    screen.getByRole("button", { name: /Create account/ });

async function fillForm(user, overrides = {}) {
    const values = {
        name: "Asha Verma",
        email: "Asha.Verma@Example.Test",
        password: STRONG,
        confirm: STRONG,
        terms: true,
        ...overrides,
    };
    for (const [label, value] of [
        ["Full name", values.name],
        ["Email", values.email],
        ["Password", values.password],
        ["Confirm password", values.confirm],
    ]) {
        if (!value) continue;
        await user.click(field(label));
        await user.paste(value);
    }
    if (values.terms) await user.click(screen.getByRole("checkbox"));
}

describe("SignupForm validation", () => {
    it("lists every problem in a focused summary and sends nothing", async () => {
        const bodies = captureRegister();
        const user = userEvent.setup();
        renderSignup();
        await user.click(submitButton());
        const summary = await screen.findByRole("group", {
            name: "There are 5 problems with your entry",
        });
        await waitFor(() => expect(summary).toHaveFocus());
        expect(within(summary).getAllByRole("link")).toHaveLength(5);
        expect(bodies).toHaveLength(0);
    });

    it("moves focus to the field when a summary entry is chosen", async () => {
        const user = userEvent.setup();
        renderSignup();
        await user.click(submitButton());
        const summary = await screen.findByRole("group", {
            name: /problems with your entry/,
        });
        await user.click(
            within(summary).getByRole("link", { name: /^Email:/ })
        );
        expect(field("Email")).toHaveFocus();
    });

    it("explains each field rule", async () => {
        const user = userEvent.setup();
        renderSignup();
        await fillForm(user, {
            name: "A",
            email: "nope",
            password: "short",
            confirm: "different",
            terms: false,
        });
        await user.click(submitButton());
        expect(
            await screen.findAllByText("Enter at least 2 characters.")
        ).not.toHaveLength(0);
        expect(
            screen.getAllByText("Enter a valid email address.")
        ).not.toHaveLength(0);
        expect(
            screen.getAllByText("Use at least 10 characters.")
        ).not.toHaveLength(0);
        expect(
            screen.getAllByText(
                "You must agree to the Terms of Use and Privacy Policy to continue."
            )
        ).not.toHaveLength(0);
    });

    it.each([
        ["a common password", "password123", /too common/],
        [
            "a password containing the email name",
            "asha.verma is here 1",
            /first part of your email address/,
        ],
    ])("rejects %s", async (_name, password, message) => {
        const user = userEvent.setup();
        renderSignup();
        await fillForm(user, { password, confirm: password });
        await user.click(submitButton());
        expect((await screen.findAllByText(message)).length).toBeGreaterThan(0);
    });

    it("rejects a password containing the person's name", async () => {
        const user = userEvent.setup();
        renderSignup();
        await fillForm(user, {
            name: "Meenakshi Iyer",
            email: "m@example.test",
            password: "meenakshi forever 1",
            confirm: "meenakshi forever 1",
        });
        await user.click(submitButton());
        expect(
            (await screen.findAllByText(/must not contain your name/)).length
        ).toBeGreaterThan(0);
    });

    it("counts bytes, not characters: 72 ASCII characters pass, 73 fail", async () => {
        const bodies = captureRegister();
        const user = userEvent.setup();
        renderSignup();
        const ok = "a1".repeat(36);
        await fillForm(user, { password: ok, confirm: ok });
        await user.click(submitButton());
        await waitFor(() => expect(bodies).toHaveLength(1));
    });

    it("rejects 73 bytes and shows the overage live", async () => {
        const bodies = captureRegister();
        const user = userEvent.setup();
        renderSignup();
        const tooLong = `${"a1".repeat(36)}x`;
        await fillForm(user, { password: tooLong, confirm: tooLong });
        expect(screen.getByText("73 of 72 bytes used")).toBeInTheDocument();
        expect(screen.getByText(/1 byte over the limit/)).toBeInTheDocument();
        await user.click(submitButton());
        expect(
            (await screen.findAllByText(/Use at most 72 bytes/)).length
        ).toBeGreaterThan(0);
        expect(bodies).toHaveLength(0);
    });

    it("measures UTF-8 bytes: 24 Devanagari letters (72 bytes) pass, 25 (75 bytes) fail", async () => {
        const bodies = captureRegister();
        const user = userEvent.setup();
        renderSignup();
        await fillForm(user, {
            password: "क".repeat(25),
            confirm: "क".repeat(25),
        });
        expect(screen.getByText("75 of 72 bytes used")).toBeInTheDocument();
        expect(screen.getByText(/3 bytes over the limit/)).toBeInTheDocument();
        await user.click(submitButton());
        expect(
            (await screen.findAllByText(/Use at most 72 bytes/)).length
        ).toBeGreaterThan(0);
        expect(bodies).toHaveLength(0);
    });

    it("accepts exactly 72 bytes of multi-byte letters", async () => {
        const bodies = captureRegister();
        const user = userEvent.setup();
        renderSignup();
        await fillForm(user, {
            password: "क".repeat(24),
            confirm: "क".repeat(24),
        });
        expect(screen.getByText("72 of 72 bytes used")).toBeInTheDocument();
        await user.click(submitButton());
        await waitFor(() => expect(bodies).toHaveLength(1));
    });
});

describe("SignupForm password hint", () => {
    it("updates the checklist and byte meter as the person types", async () => {
        const user = userEvent.setup();
        renderSignup();
        expect(screen.getByText("0 of 72 bytes used")).toBeInTheDocument();
        await user.type(field("Password"), "abcde");
        expect(screen.getByText("5 of 72 bytes used")).toBeInTheDocument();
        const item = screen.getByText("At least 10 characters").closest("li");
        expect(within(item).getByText("Not met")).toBeInTheDocument();
        await user.type(field("Password"), "fghijk");
        expect(within(item).getByText("Met")).toBeInTheDocument();
    });
});

describe("SignupForm semantics", () => {
    it("sets the credential autocomplete attributes", () => {
        renderSignup();
        expect(field("Full name")).toHaveAttribute("autocomplete", "name");
        expect(field("Email")).toHaveAttribute("autocomplete", "email");
        expect(field("Password")).toHaveAttribute(
            "autocomplete",
            "new-password"
        );
        expect(field("Confirm password")).toHaveAttribute(
            "autocomplete",
            "new-password"
        );
        expect(field("Password")).not.toHaveAttribute("maxlength");
    });

    it("links the consent to the terms and privacy pages in a new tab", () => {
        renderSignup();
        const consent = within(
            screen.getByRole("checkbox").closest("[role=group]")
        );
        const terms = consent.getByRole("link", { name: /Terms of Use/ });
        const privacy = consent.getByRole("link", { name: /Privacy Policy/ });
        expect(terms).toHaveAttribute("href", "/terms");
        expect(terms).toHaveAttribute("target", "_blank");
        expect(terms).toHaveAttribute("rel", "noopener noreferrer");
        expect(privacy).toHaveAttribute("href", "/privacy");
        expect(privacy).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("toggles consent with the keyboard", async () => {
        const user = userEvent.setup();
        renderSignup();
        const box = screen.getByRole("checkbox");
        box.focus();
        await user.keyboard(" ");
        expect(box).toBeChecked();
    });

    it("prefills name and email from the invitation link values", () => {
        renderSignup({
            props: {
                defaultValues: { name: "Dr. Rao", email: "rao@example.test" },
            },
        });
        expect(field("Full name")).toHaveValue("Dr. Rao");
        expect(field("Email")).toHaveValue("rao@example.test");
    });

    it("has no accessibility violations, empty or with the summary open", async () => {
        const user = userEvent.setup();
        const { container } = renderSignup();
        await expectAccessible(container);
        await user.click(submitButton());
        await screen.findByRole("group", { name: /problems with your entry/ });
        await expectAccessible(container);
    });

    it("renders in Hindi without accessibility violations", async () => {
        await i18n.changeLanguage("hi");
        const { container } = renderSignup();
        expect(screen.getByLabelText("पूरा नाम")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "खाता बनाएँ" })
        ).toBeInTheDocument();
        await expectAccessible(container);
    });
});

describe("SignupForm submit", () => {
    it("posts only the API fields and shows the neutral check-your-inbox screen", async () => {
        const bodies = captureRegister();
        const user = userEvent.setup();
        const { router, store } = renderSignup();
        await fillForm(user);
        await user.click(submitButton());
        await waitFor(() => expect(where(router)).toBe("/verify-email-sent"));
        expect(bodies[0]).toEqual({
            name: "Asha Verma",
            email: "asha.verma@example.test",
            password: STRONG,
            acceptTerms: true,
        });
        expect(selectPendingEmail(store.getState())).toBe(
            "asha.verma@example.test"
        );
    });

    it("ignores a second submit while the first is in flight", async () => {
        let calls = 0;
        let release;
        const gate = new Promise((resolve) => {
            release = resolve;
        });
        server.use(
            http.post(registerUrl, async () => {
                calls += 1;
                await gate;
                return okResponse(null, { status: 202 });
            })
        );
        const user = userEvent.setup();
        const { router } = renderSignup();
        await fillForm(user);
        await user.click(submitButton());
        expect(submitButton()).toBeDisabled();
        expect(submitButton()).toHaveAttribute("aria-busy", "true");
        await user.click(submitButton());
        await user.keyboard("{Enter}");
        release();
        await waitFor(() => expect(where(router)).toBe("/verify-email-sent"));
        expect(calls).toBe(1);
    });

    it("maps DOMAIN_NOT_ALLOWED onto the email field with an explicit message", async () => {
        captureRegister(() => errorResponse(403, "DOMAIN_NOT_ALLOWED"));
        const user = userEvent.setup();
        renderSignup();
        await fillForm(user);
        await user.click(submitButton());
        expect(
            await screen.findByText("This email domain is not allowed.")
        ).toBeInTheDocument();
        await waitFor(() => expect(field("Email")).toHaveFocus());
        expect(field("Email")).toHaveAttribute("aria-invalid", "true");
    });

    it("maps PASSWORD_POLICY onto the password field and keeps the input", async () => {
        captureRegister(() => errorResponse(400, "PASSWORD_POLICY"));
        const user = userEvent.setup();
        renderSignup();
        await fillForm(user);
        await user.click(submitButton());
        expect(
            await screen.findByText(
                "This password does not meet the requirements."
            )
        ).toBeInTheDocument();
        expect(field("Password")).toHaveValue(STRONG);
        expect(field("Full name")).toHaveValue("Asha Verma");
    });

    it("maps a server field error onto its field", async () => {
        captureRegister(() =>
            errorResponse(400, "VALIDATION_ERROR", {
                errors: [{ field: "name", message: "Name is not allowed." }],
            })
        );
        const user = userEvent.setup();
        renderSignup();
        await fillForm(user);
        await user.click(submitButton());
        expect(
            await screen.findByText("Name is not allowed.")
        ).toBeInTheDocument();
        await waitFor(() => expect(field("Full name")).toHaveFocus());
    });

    it.each([
        [
            "RATE_LIMITED",
            429,
            "Too many requests. Please wait a moment and try again.",
        ],
        [
            "SERVER_ERROR",
            500,
            "The server ran into a problem. Please try again.",
        ],
    ])("shows a form-level message for %s", async (code, status, text) => {
        captureRegister(() => errorResponse(status, code));
        const user = userEvent.setup();
        renderSignup();
        await fillForm(user);
        await user.click(submitButton());
        expect(await screen.findByText(text)).toBeInTheDocument();
        expect(field("Email")).toHaveValue("Asha.Verma@Example.Test");
    });
});

describe("SignupForm password confirmation", () => {
    it("asks for the same password twice", async () => {
        const bodies = captureRegister();
        const user = userEvent.setup();
        renderSignup();
        await fillForm(user, { confirm: `${STRONG}!` });
        await user.click(submitButton());
        expect(
            (await screen.findAllByText("The passwords do not match.")).length
        ).toBeGreaterThan(0);
        expect(bodies).toHaveLength(0);
    });
});
