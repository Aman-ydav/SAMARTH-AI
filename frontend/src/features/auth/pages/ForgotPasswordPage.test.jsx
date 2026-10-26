import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPasswordPage from "@/features/auth/pages/ForgotPasswordPage";
import { i18n } from "@/i18n";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { anonymousAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { setMotionTier } from "@/test/motionTier";
import { renderAuthPage } from "@/test/renderAuthPage";

const server = setupMockServer();
const url = apiUrl("/auth/forgot-password");

beforeEach(() => setMotionTier("reduced"));
afterEach(async () => {
    vi.useRealTimers();
    await i18n.changeLanguage("en");
});

const renderForgot = () =>
    renderAuthPage(<ForgotPasswordPage />, {
        path: "/forgot-password",
        preloadedState: { auth: anonymousAuth },
    });

function capture(response = () => okResponse(null)) {
    const bodies = [];
    server.use(
        http.post(url, async ({ request }) => {
            bodies.push(await request.clone().json());
            return response();
        })
    );
    return bodies;
}

async function advance(ms) {
    await act(async () => {});
    act(() => {
        vi.advanceTimersByTime(ms);
    });
}

const FAKE = { toFake: ["Date", "setInterval", "clearInterval"] };

describe("ForgotPasswordPage", () => {
    it("has one h1, one main landmark and a sign-in link", async () => {
        const { container } = renderForgot();
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "Forgot your password?",
            })
        ).toBeInTheDocument();
        expect(screen.getAllByRole("main")).toHaveLength(1);
        expect(
            screen.getByRole("link", { name: "Back to log in" })
        ).toHaveAttribute("href", "/login");
        expect(document.title).toBe("Forgot your password? | SAMARTH AI");
        await expectAccessible(container);
    });

    it("validates the email before sending", async () => {
        const bodies = capture();
        const user = userEvent.setup();
        renderForgot();
        await user.click(
            screen.getByRole("button", { name: "Send reset link" })
        );
        expect(
            await screen.findByText("Enter your email address.")
        ).toBeInTheDocument();
        await user.type(screen.getByLabelText("Email"), "nope");
        await user.click(
            screen.getByRole("button", { name: "Send reset link" })
        );
        expect(
            await screen.findByText("Enter a valid email address.")
        ).toBeInTheDocument();
        expect(bodies).toHaveLength(0);
    });

    it("shows the same neutral confirmation and moves focus to it", async () => {
        const bodies = capture();
        const user = userEvent.setup();
        const { container } = renderForgot();
        await user.type(
            screen.getByLabelText("Email"),
            " Someone@Example.Test "
        );
        await user.click(
            screen.getByRole("button", { name: "Send reset link" })
        );
        const title = await screen.findByRole("heading", {
            name: "Reset link sent",
        });
        await waitFor(() => expect(title).toHaveFocus());
        expect(bodies[0]).toEqual({ email: "someone@example.test" });
        expect(
            screen.getByText(
                /If an account exists for that email, we sent a reset link/
            )
        ).toBeInTheDocument();
        expect(
            screen.queryByText("someone@example.test")
        ).not.toBeInTheDocument();
        expect(document.title).toBe("Reset link sent | SAMARTH AI");
        await expectAccessible(container);
    });

    it("lets the person resend only after the 60 second cooldown", async () => {
        const bodies = capture();
        vi.useFakeTimers(FAKE);
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        renderForgot();
        await user.type(screen.getByLabelText("Email"), "a@example.test");
        await user.click(
            screen.getByRole("button", { name: "Send reset link" })
        );
        const wait = await screen.findByRole("button", {
            name: /Resend in 60 s/,
        });
        expect(wait).toBeDisabled();
        await advance(61000);
        await user.click(screen.getByRole("button", { name: "Resend" }));
        await waitFor(() => expect(bodies).toHaveLength(2));
        expect(
            screen.getByRole("button", { name: /Resend in 60 s/ })
        ).toBeDisabled();
    });

    it("blocks resubmitting during an IP rate limit and shows the countdown", async () => {
        capture(() =>
            errorResponse(429, "RATE_LIMITED", {
                headers: { "Retry-After": "45" },
            })
        );
        vi.useFakeTimers(FAKE);
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        renderForgot();
        await user.type(screen.getByLabelText("Email"), "a@example.test");
        await user.click(
            screen.getByRole("button", { name: "Send reset link" })
        );
        expect(
            await screen.findByText("You can try again in 0:45.")
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Send reset link" })
        ).toBeDisabled();
        await advance(46000);
        expect(
            screen.getByRole("button", { name: "Send reset link" })
        ).toBeEnabled();
    });

    it("keeps the email when the network fails", async () => {
        server.use(http.post(url, () => Response.error()));
        const user = userEvent.setup();
        renderForgot();
        await user.type(screen.getByLabelText("Email"), "a@example.test");
        await user.click(
            screen.getByRole("button", { name: "Send reset link" })
        );
        expect(
            await screen.findByText(/could not reach the server/)
        ).toBeInTheDocument();
        expect(screen.getByLabelText("Email")).toHaveValue("a@example.test");
    });

    it("renders in Hindi", async () => {
        await i18n.changeLanguage("hi");
        const { container } = renderForgot();
        expect(
            screen.getByRole("heading", { level: 1, name: "पासवर्ड भूल गए?" })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "रीसेट लिंक भेजें" })
        ).toBeInTheDocument();
        await expectAccessible(container);
    });
});
