import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selectPendingEmail } from "@/features/auth";
import VerifyEmailSentPage from "@/features/auth/pages/VerifyEmailSentPage";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { anonymousAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { setMotionTier } from "@/test/motionTier";
import { renderAuthPage, where } from "@/test/renderAuthPage";

const server = setupMockServer();
const url = apiUrl("/auth/resend-verification");
const FAKE = { toFake: ["Date", "setInterval", "clearInterval"] };

beforeEach(() => setMotionTier("reduced"));
afterEach(() => vi.useRealTimers());

const renderSent = (pendingEmail = "meera@example.test") =>
    renderAuthPage(<VerifyEmailSentPage />, {
        path: "/verify-email-sent",
        preloadedState: { auth: { ...anonymousAuth, pendingEmail } },
    });

async function pastCooldown() {
    await screen.findByRole("button", { name: /Resend in 60 s/ });
    await act(async () => {});
    act(() => {
        vi.advanceTimersByTime(61000);
    });
}

describe("VerifyEmailSentPage", () => {
    it("sends a visitor with no pending email back to sign-up", async () => {
        const { router } = renderSent(null);
        await waitFor(() => expect(where(router)).toBe("/signup"));
    });

    it("shows the neutral instruction with the address and spam advice", async () => {
        const { container } = renderSent();
        expect(
            screen.getByRole("heading", { level: 1, name: "Check your inbox" })
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                /If an account can be created with meera@example.test/
            )
        ).toBeInTheDocument();
        expect(screen.getByText(/Check your spam folder/)).toBeInTheDocument();
        expect(document.title).toBe("Check your inbox | SAMARTH AI");
        await expectAccessible(container);
    });

    it("resends only after the cooldown and shows the neutral result", async () => {
        const bodies = [];
        server.use(
            http.post(url, async ({ request }) => {
                bodies.push(await request.clone().json());
                return okResponse(null);
            })
        );
        vi.useFakeTimers(FAKE);
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        renderSent();
        expect(
            await screen.findByRole("button", { name: /Resend in 60 s/ })
        ).toBeDisabled();
        await pastCooldown();
        await user.click(screen.getByRole("button", { name: "Resend email" }));
        await waitFor(() =>
            expect(bodies).toEqual([{ email: "meera@example.test" }])
        );
        expect(
            await screen.findByText(
                "If the address is pending verification, we sent a new link."
            )
        ).toBeInTheDocument();
    });

    it("restarts the cooldown from retryAfterSec when the server limits the resend", async () => {
        server.use(
            http.post(url, () =>
                errorResponse(429, "RATE_LIMITED", {
                    headers: { "Retry-After": "25" },
                })
            )
        );
        vi.useFakeTimers(FAKE);
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        renderSent();
        await pastCooldown();
        await user.click(screen.getByRole("button", { name: "Resend email" }));
        expect(
            await screen.findByText(/Too many requests/)
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /Resend in 25 s/ })
        ).toBeDisabled();
    });

    it("lets the person change the address by going back to sign-up", async () => {
        const user = userEvent.setup();
        const { router, store } = renderSent();
        await user.click(screen.getByRole("link", { name: "Change email" }));
        await waitFor(() => expect(where(router)).toBe("/signup"));
        expect(selectPendingEmail(store.getState())).toBeNull();
    });
});
