import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AccountDeactivatedPage from "@/features/auth/pages/AccountDeactivatedPage";
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
    return { env: { ...actual.env, googleEnabled: false, googleClientId: "" } };
});

const server = setupMockServer();
const loginUrl = apiUrl("/auth/login");

beforeEach(() => setMotionTier("reduced"));
afterEach(async () => {
    await i18n.changeLanguage("en");
});

const renderDeactivated = (state) =>
    renderAuthPage(<AccountDeactivatedPage />, {
        path: "/account-deactivated",
        state,
        preloadedState: { auth: anonymousAuth },
    });

describe("AccountDeactivatedPage", () => {
    it("asks for the password again, prefilled with the email from router state", async () => {
        const { container } = renderDeactivated({ email: "asha@example.test" });
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "Account deactivated or scheduled for deletion",
            })
        ).toBeInTheDocument();
        expect(screen.getByLabelText("Email")).toHaveValue("asha@example.test");
        expect(screen.getByLabelText("Password")).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Back to log in" })
        ).toHaveAttribute("href", "/login");
        await expectAccessible(container);
    });

    it("ignores a non-string email in router state", () => {
        renderDeactivated({ email: { evil: true } });
        expect(screen.getByLabelText("Email")).toHaveValue("");
    });

    it("re-submits the login with reactivate: true and shows the restored confirmation", async () => {
        const bodies = [];
        server.use(
            http.post(loginUrl, async ({ request }) => {
                bodies.push(await request.clone().json());
                return okResponse(makeSessionData({ reactivate: true }));
            })
        );
        const user = userEvent.setup();
        const { store } = renderDeactivated({ email: "asha@example.test" });
        await user.type(
            screen.getByLabelText("Password"),
            "correct horse battery"
        );
        await user.click(
            screen.getByRole("button", { name: "Reactivate account" })
        );
        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).toEqual({
            email: "asha@example.test",
            password: "correct horse battery",
            rememberMe: false,
            reactivate: true,
        });
        await waitFor(() =>
            expect(store.getState().auth.reactivated).toBe(true)
        );
    });

    it("does not loop back to itself when the account is still deactivated", async () => {
        server.use(
            http.post(loginUrl, () => errorResponse(403, "ACCOUNT_DEACTIVATED"))
        );
        const user = userEvent.setup();
        const { router } = renderDeactivated({ email: "asha@example.test" });
        await user.type(
            screen.getByLabelText("Password"),
            "correct horse battery"
        );
        await user.click(
            screen.getByRole("button", { name: "Reactivate account" })
        );
        expect(
            await screen.findByText(
                "This account is deactivated. Sign in again to reactivate it."
            )
        ).toBeInTheDocument();
        expect(where(router)).toBe("/account-deactivated");
    });

    it("shows the generic message for a wrong password", async () => {
        server.use(
            http.post(loginUrl, () => errorResponse(401, "INVALID_CREDENTIALS"))
        );
        const user = userEvent.setup();
        renderDeactivated({ email: "asha@example.test" });
        await user.type(screen.getByLabelText("Password"), "wrong password!!");
        await user.click(
            screen.getByRole("button", { name: "Reactivate account" })
        );
        expect(
            await screen.findByText("Invalid email or password.")
        ).toBeInTheDocument();
    });

    it("renders in Hindi", async () => {
        await i18n.changeLanguage("hi");
        const { container } = renderDeactivated();
        expect(
            screen.getByRole("button", { name: "खाता फिर सक्रिय करें" })
        ).toBeInTheDocument();
        await expectAccessible(container);
    });
});
