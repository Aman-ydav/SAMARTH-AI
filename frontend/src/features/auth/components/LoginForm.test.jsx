import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { selectJustReactivated, selectLockout } from "@/features/auth";
import { i18n } from "@/i18n";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { makeSessionData } from "@/mocks/fixtures/user";
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

const PASSWORD = "correct horse battery";
const loginUrl = apiUrl("/auth/login");

beforeEach(() => setMotionTier("reduced"));
afterEach(async () => {
    vi.useRealTimers();
    await i18n.changeLanguage("en");
});

/** Lets effects (and so the countdown subscription) settle, then moves the faked clock. */
async function advance(ms) {
    await act(async () => {});
    act(() => {
        vi.advanceTimersByTime(ms);
    });
}

function renderLogin(options = {}) {
    return renderAuthPage(<LoginForm {...options.props} />, {
        path: "/login",
        preloadedState: { auth: anonymousAuth },
        ...options,
    });
}

async function fillAndSubmit(
    user,
    { email = "Asha.Verma@Example.Test ", password = PASSWORD } = {}
) {
    await user.type(screen.getByLabelText("Email"), email);
    await user.type(screen.getByLabelText("Password"), password);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
}

function captureLogin(response = () => okResponse(makeSessionData())) {
    const bodies = [];
    server.use(
        http.post(loginUrl, async ({ request }) => {
            bodies.push(await request.clone().json());
            return response();
        })
    );
    return bodies;
}

describe("LoginForm validation", () => {
    it("shows required messages and sends nothing on an empty submit", async () => {
        const bodies = captureLogin();
        const user = userEvent.setup();
        renderLogin();
        await user.click(screen.getByRole("button", { name: "Sign in" }));
        expect(
            await screen.findByText("Enter your email address.")
        ).toBeInTheDocument();
        expect(screen.getByText("Enter your password.")).toBeInTheDocument();
        expect(bodies).toHaveLength(0);
    });

    it("moves focus to the first invalid field", async () => {
        const user = userEvent.setup();
        renderLogin();
        await user.click(screen.getByRole("button", { name: "Sign in" }));
        await waitFor(() =>
            expect(screen.getByLabelText("Email")).toHaveFocus()
        );
        expect(screen.getByLabelText("Email")).toHaveAttribute(
            "aria-invalid",
            "true"
        );
    });

    it("rejects a malformed email, then clears the message as soon as it is fixed", async () => {
        const user = userEvent.setup();
        renderLogin();
        await user.type(screen.getByLabelText("Email"), "not-an-email");
        await user.type(screen.getByLabelText("Password"), PASSWORD);
        await user.click(screen.getByRole("button", { name: "Sign in" }));
        expect(
            await screen.findByText("Enter a valid email address.")
        ).toBeInTheDocument();
        await user.type(screen.getByLabelText("Email"), "@example.test");
        await waitFor(() =>
            expect(
                screen.queryByText("Enter a valid email address.")
            ).not.toBeInTheDocument()
        );
    });

    it("rejects a password above 72 UTF-8 bytes (24 Devanagari letters fit, 25 do not)", async () => {
        const bodies = captureLogin();
        const user = userEvent.setup();
        renderLogin();
        await user.type(screen.getByLabelText("Email"), "asha@example.test");
        await user.type(screen.getByLabelText("Password"), "अ".repeat(25));
        await user.click(screen.getByRole("button", { name: "Sign in" }));
        expect(
            await screen.findByText(/Use at most 72 bytes/)
        ).toBeInTheDocument();
        expect(bodies).toHaveLength(0);
    });
});

describe("LoginForm semantics", () => {
    it("uses the credential autocomplete attributes and never blocks paste", () => {
        renderLogin();
        const email = screen.getByLabelText("Email");
        const password = screen.getByLabelText("Password");
        expect(email).toHaveAttribute("type", "email");
        expect(email).toHaveAttribute("autocomplete", "username");
        expect(password).toHaveAttribute("autocomplete", "current-password");
        expect(password).not.toHaveAttribute("maxlength");
        expect(password).toHaveAttribute("type", "password");
    });

    it("toggles password visibility from a labelled button", async () => {
        const user = userEvent.setup();
        renderLogin();
        const toggle = screen.getByRole("button", { name: "Show password" });
        await user.click(toggle);
        expect(screen.getByLabelText("Password")).toHaveAttribute(
            "type",
            "text"
        );
        expect(
            screen.getByRole("button", { name: "Hide password" })
        ).toBeInTheDocument();
    });

    it("shows no Google-or-reset hint line (AUTH-34), only the forgot link", () => {
        renderLogin();
        expect(
            screen.queryByText("Sign in with Google or reset your password.")
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Forgot password?" })
        ).toBeInTheDocument();
    });

    it("hides the Google section when no client id is configured", () => {
        renderLogin();
        expect(
            screen.queryByRole("group", { name: "Sign in with Google" })
        ).not.toBeInTheDocument();
    });

    it("is operable from the keyboard: tab order, then Enter in the password field submits", async () => {
        const bodies = captureLogin();
        const user = userEvent.setup();
        renderLogin();
        screen.getByLabelText("Email").focus();
        expect(screen.getByLabelText("Email")).toHaveFocus();
        await user.keyboard("asha@example.test");
        await user.tab();
        expect(
            screen.getByRole("link", { name: "Forgot password?" })
        ).toHaveFocus();
        await user.tab();
        expect(screen.getByLabelText("Password")).toHaveFocus();
        await user.keyboard(`${PASSWORD}{Enter}`);
        await waitFor(() => expect(bodies).toHaveLength(1));
    });

    it("has no accessibility violations, empty or with errors", async () => {
        const user = userEvent.setup();
        const { container } = renderLogin();
        await expectAccessible(container);
        await user.click(screen.getByRole("button", { name: "Sign in" }));
        await screen.findByText("Enter your email address.");
        await expectAccessible(container);
    });
});

describe("LoginForm success", () => {
    it("posts the normalised email and goes to the dashboard", async () => {
        const bodies = captureLogin();
        const user = userEvent.setup();
        const { router } = renderLogin();
        await fillAndSubmit(user);
        await waitFor(() => expect(where(router)).toBe("/dashboard"));
        expect(bodies[0]).toEqual({
            email: "asha.verma@example.test",
            password: PASSWORD,
            rememberMe: false,
        });
    });

    it("sends rememberMe when the box is ticked", async () => {
        const bodies = captureLogin();
        const user = userEvent.setup();
        renderLogin();
        await user.click(screen.getByRole("checkbox", { name: "Remember me" }));
        await fillAndSubmit(user);
        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0].rememberMe).toBe(true);
    });

    it("returns to a safe return path carried in router state", async () => {
        captureLogin();
        const user = userEvent.setup();
        const { router } = renderLogin({ state: { returnTo: "/gaps" } });
        await fillAndSubmit(user);
        await waitFor(() => expect(where(router)).toBe("/gaps"));
    });

    it.each([
        ["a protocol-relative URL", "//evil.example/steal"],
        ["an absolute URL", "https://evil.example"],
        ["a backslash path", "/\\evil.example"],
    ])("ignores %s as a return path", async (_name, returnTo) => {
        captureLogin();
        const user = userEvent.setup();
        const { router } = renderLogin({ state: { returnTo } });
        await fillAndSubmit(user);
        await waitFor(() => expect(where(router)).toBe("/dashboard"));
    });

    it("ignores an unsafe ?returnTo= query", async () => {
        captureLogin();
        const user = userEvent.setup();
        const { router } = renderLogin({
            entry: "/login?returnTo=https%3A%2F%2Fevil.example",
        });
        await fillAndSubmit(user);
        await waitFor(() => expect(where(router)).toBe("/dashboard"));
    });

    it("sends a user who still needs onboarding to /onboarding", async () => {
        captureLogin(() =>
            okResponse(makeSessionData({ needsOnboarding: true }))
        );
        const user = userEvent.setup();
        const { router } = renderLogin();
        await fillAndSubmit(user);
        await waitFor(() => expect(where(router)).toBe("/onboarding"));
    });

    it("sends a must-change-password user to /change-password", async () => {
        captureLogin(() =>
            okResponse(makeSessionData({}, { mustChangePassword: true }))
        );
        const user = userEvent.setup();
        const { router } = renderLogin();
        await fillAndSubmit(user);
        await waitFor(() => expect(where(router)).toBe("/change-password"));
    });

    it("stays put for a reactivated account so the confirm screen can show", async () => {
        captureLogin(() => okResponse(makeSessionData({ reactivate: true })));
        const user = userEvent.setup();
        const { router, store } = renderLogin();
        await fillAndSubmit(user);
        await waitFor(() =>
            expect(selectJustReactivated(store.getState())).toBe(true)
        );
        expect(where(router)).toBe("/login");
    });

    it("re-submits with reactivate: true in reactivation mode", async () => {
        const bodies = captureLogin();
        const user = userEvent.setup();
        renderLogin({
            props: { reactivate: true, defaultEmail: "a@example.test" },
        });
        expect(screen.getByLabelText("Email")).toHaveValue("a@example.test");
        expect(
            screen.queryByRole("checkbox", { name: "Remember me" })
        ).not.toBeInTheDocument();
        await user.type(screen.getByLabelText("Password"), PASSWORD);
        await user.click(
            screen.getByRole("button", { name: "Reactivate account" })
        );
        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0].reactivate).toBe(true);
    });
});

describe("LoginForm server errors", () => {
    it("shows one generic message for INVALID_CREDENTIALS, keeps the email, clears and focuses the password", async () => {
        captureLogin(() => errorResponse(401, "INVALID_CREDENTIALS"));
        const user = userEvent.setup();
        renderLogin();
        await fillAndSubmit(user);
        expect(
            await screen.findByText("Invalid email or password.")
        ).toBeInTheDocument();
        expect(
            screen.queryByText("Sign in with Google or reset your password.")
        ).not.toBeInTheDocument();
        expect(screen.getByLabelText("Email")).toHaveValue(
            "Asha.Verma@Example.Test"
        );
        await waitFor(() =>
            expect(screen.getByLabelText("Password")).toHaveValue("")
        );
        await waitFor(() =>
            expect(screen.getByLabelText("Password")).toHaveFocus()
        );
    });

    it("keeps the typed values after a network failure (no server answer)", async () => {
        server.use(http.post(loginUrl, () => Response.error()));
        const user = userEvent.setup();
        renderLogin();
        await fillAndSubmit(user);
        expect(
            await screen.findByText(
                "We could not reach the server. Check your connection and try again."
            )
        ).toBeInTheDocument();
        expect(screen.getByLabelText("Password")).toHaveValue(PASSWORD);
    });

    it("explains CSRF_INVALID in plain words", async () => {
        captureLogin(() => errorResponse(403, "CSRF_INVALID"));
        const user = userEvent.setup();
        renderLogin();
        await fillAndSubmit(user);
        expect(
            await screen.findByText(
                "Your session check failed. Reload the page and try again."
            )
        ).toBeInTheDocument();
    });

    it("fails fast with an offline message and sends nothing", async () => {
        const bodies = captureLogin();
        vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
        const user = userEvent.setup();
        renderLogin();
        await fillAndSubmit(user);
        expect(
            await screen.findByText("You are offline. Reconnect and try again.")
        ).toBeInTheDocument();
        expect(bodies).toHaveLength(0);
    });

    it("shows the request id for a server error", async () => {
        captureLogin(() =>
            errorResponse(500, "SERVER_ERROR", { requestId: "req-abc-123" })
        );
        const user = userEvent.setup();
        renderLogin();
        await fillAndSubmit(user);
        expect(
            await screen.findByText("Request ID: req-abc-123")
        ).toBeInTheDocument();
    });

    it("maps a field error from the server onto its field and focuses it", async () => {
        captureLogin(() =>
            errorResponse(400, "VALIDATION_ERROR", {
                errors: [
                    {
                        field: "email",
                        message: "Email domain is not recognised.",
                        code: "INVALID",
                    },
                ],
            })
        );
        const user = userEvent.setup();
        renderLogin();
        await fillAndSubmit(user);
        expect(
            await screen.findByText("Email domain is not recognised.")
        ).toBeInTheDocument();
        await waitFor(() =>
            expect(screen.getByLabelText("Email")).toHaveFocus()
        );
        expect(
            screen.queryByText("Please check the highlighted fields.")
        ).not.toBeInTheDocument();
    });

    it("blocks submitting during a 429 and counts down from retryAfterSec", async () => {
        captureLogin(() =>
            errorResponse(429, "RATE_LIMITED", {
                headers: { "Retry-After": "20" },
            })
        );
        vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        renderLogin();
        await fillAndSubmit(user);
        expect(
            await screen.findByText(/Too many requests/)
        ).toBeInTheDocument();
        expect(
            screen.getByText("You can try again in 0:20.")
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
        await advance(21000);
        expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    });

    it("routes ACCOUNT_LOCKED to /account-locked and stores the lock deadline", async () => {
        captureLogin(() =>
            errorResponse(423, "ACCOUNT_LOCKED", {
                headers: { "Retry-After": "900" },
            })
        );
        const user = userEvent.setup();
        const { router, store } = renderLogin({
            state: { returnTo: "/gaps" },
        });
        await fillAndSubmit(user);
        await waitFor(() => expect(where(router)).toBe("/account-locked"));
        expect(router.state.location.state).toEqual({ returnTo: "/gaps" });
        expect(selectLockout(store.getState()).until).toBeGreaterThan(
            Date.now() + 800000
        );
    });

    it("routes ACCOUNT_SUSPENDED to /account-suspended", async () => {
        captureLogin(() => errorResponse(403, "ACCOUNT_SUSPENDED"));
        const user = userEvent.setup();
        const { router } = renderLogin();
        await fillAndSubmit(user);
        await waitFor(() => expect(where(router)).toBe("/account-suspended"));
    });

    it("routes ACCOUNT_DEACTIVATED to /account-deactivated with the email in router state only", async () => {
        captureLogin(() => errorResponse(403, "ACCOUNT_DEACTIVATED"));
        const user = userEvent.setup();
        const { router } = renderLogin();
        await fillAndSubmit(user);
        await waitFor(() => expect(where(router)).toBe("/account-deactivated"));
        expect(router.state.location.state.email).toBe(
            "asha.verma@example.test"
        );
        expect(router.state.location.search).toBe("");
    });
});

describe("LoginForm unverified email", () => {
    it("offers a resend with a cooldown taken from retryAfterSec", async () => {
        captureLogin(() =>
            errorResponse(403, "EMAIL_NOT_VERIFIED", {
                headers: { "Retry-After": "30" },
            })
        );
        const resends = [];
        server.use(
            http.post(
                apiUrl("/auth/resend-verification"),
                async ({ request }) => {
                    resends.push(await request.clone().json());
                    return okResponse(null);
                }
            )
        );
        vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        renderLogin();
        await fillAndSubmit(user);
        expect(
            await screen.findByText(/email address is not verified yet/i)
        ).toBeInTheDocument();
        const resend = await screen.findByRole("button", {
            name: /Resend in 30 s/,
        });
        expect(resend).toBeDisabled();
        await advance(31000);
        const ready = screen.getByRole("button", { name: "Resend email" });
        expect(ready).toBeEnabled();
        await user.click(ready);
        await waitFor(() => expect(resends).toHaveLength(1));
        expect(resends[0]).toEqual({ email: "asha.verma@example.test" });
        expect(
            await screen.findByText(
                "If the address is pending verification, we sent a new link."
            )
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /Resend in 60 s/ })
        ).toBeDisabled();
    });
});

describe("LoginForm submitting state", () => {
    it("disables the controls and marks the button busy, then ignores a second submit", async () => {
        let calls = 0;
        let release;
        const gate = new Promise((resolve) => {
            release = resolve;
        });
        server.use(
            http.post(loginUrl, async () => {
                calls += 1;
                await gate;
                return okResponse(makeSessionData());
            })
        );
        const user = userEvent.setup();
        const { router } = renderLogin();
        await user.type(screen.getByLabelText("Email"), "asha@example.test");
        await user.type(screen.getByLabelText("Password"), PASSWORD);
        const submit = screen.getByRole("button", { name: "Sign in" });
        await user.click(submit);
        expect(submit).toBeDisabled();
        expect(submit).toHaveAttribute("aria-busy", "true");
        expect(screen.getByLabelText("Email")).toBeDisabled();
        await user.click(submit);
        await user.keyboard("{Enter}");
        release();
        await waitFor(() => expect(where(router)).toBe("/dashboard"));
        expect(calls).toBe(1);
    });
});

describe("LoginForm environment", () => {
    it("explains cookies are off and blocks the submit", () => {
        vi.spyOn(navigator, "cookieEnabled", "get").mockReturnValue(false);
        renderLogin();
        expect(screen.getByText(/Cookies are turned off/)).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "How to turn on cookies" })
        ).toHaveAttribute("href", "/cookies-disabled");
        expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    });

    it("shows a running lock from the store and blocks the submit until it ends", async () => {
        vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
        renderLogin({
            preloadedState: {
                auth: {
                    ...anonymousAuth,
                    lockout: { until: Date.now() + 90000 },
                },
            },
        });
        expect(
            screen.getByText(
                "Too many unsuccessful attempts. You can try again in 1:30."
            )
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
        await advance(91000);
        expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    });

    it("renders in Hindi with the same structure", async () => {
        await i18n.changeLanguage("hi");
        const { container } = renderLogin();
        expect(screen.getByLabelText("ईमेल")).toBeInTheDocument();
        expect(screen.getByLabelText("पासवर्ड")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "साइन इन करें" })
        ).toBeInTheDocument();
        await expectAccessible(container);
    });
});
