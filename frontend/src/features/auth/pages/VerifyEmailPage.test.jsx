import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import VerifyEmailPage from "@/features/auth/pages/VerifyEmailPage";
import { i18n } from "@/i18n";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { makeSessionData } from "@/mocks/fixtures/user";
import { anonymousAuth, signedInAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { setMotionTier } from "@/test/motionTier";
import { renderAuthPage, where } from "@/test/renderAuthPage";

const server = setupMockServer();
const verifyUrl = apiUrl("/auth/verify-email");
const TOKEN = "tok-verify-0123456789";

beforeEach(() => setMotionTier("reduced"));
afterEach(async () => {
    window.history.replaceState(null, "", "/");
    await i18n.changeLanguage("en");
});

function track(
    response = () => okResponse(makeSessionData({ needsOnboarding: true }))
) {
    const bodies = [];
    server.use(
        http.post(verifyUrl, async ({ request }) => {
            bodies.push(await request.clone().json());
            return response();
        })
    );
    return bodies;
}

function renderVerify({ hash = `#token=${TOKEN}`, auth = anonymousAuth } = {}) {
    window.history.replaceState(null, "", `/verify-email${hash}`);
    return renderAuthPage(<VerifyEmailPage />, {
        path: "/verify-email",
        entry: `/verify-email${hash}`,
        preloadedState: { auth },
    });
}

describe("VerifyEmailPage confirm-then-POST", () => {
    it("shows a confirm button and consumes nothing until it is pressed", async () => {
        const bodies = track();
        const { container } = renderVerify();
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "Confirm your email",
            })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Confirm email" })
        ).toBeEnabled();
        expect(window.location.hash).toBe("");
        expect(bodies).toHaveLength(0);
        await expectAccessible(container);
    });

    it("posts the token on confirm and continues to onboarding signed in", async () => {
        const bodies = track();
        const user = userEvent.setup();
        const { router, store } = renderVerify();
        await user.click(screen.getByRole("button", { name: "Confirm email" }));
        await waitFor(() => expect(where(router)).toBe("/onboarding"));
        expect(bodies).toEqual([{ token: TOKEN }]);
        expect(store.getState().auth.user).not.toBeNull();
        expect(JSON.stringify(store.getState())).not.toContain(TOKEN);
    });

    it("goes to the dashboard when no onboarding is needed", async () => {
        track(() => okResponse(makeSessionData({ needsOnboarding: false })));
        const user = userEvent.setup();
        const { router } = renderVerify();
        await user.click(screen.getByRole("button", { name: "Confirm email" }));
        await waitFor(() => expect(where(router)).toBe("/dashboard"));
    });

    it("sends one request for a double click", async () => {
        const bodies = track();
        const user = userEvent.setup();
        const { router } = renderVerify();
        const button = screen.getByRole("button", { name: "Confirm email" });
        await user.dblClick(button);
        await waitFor(() => expect(where(router)).toBe("/onboarding"));
        expect(bodies).toHaveLength(1);
    });

    it("keeps the button for a retry after a network failure", async () => {
        server.use(http.post(verifyUrl, () => Response.error()));
        const user = userEvent.setup();
        const { router } = renderVerify();
        await user.click(screen.getByRole("button", { name: "Confirm email" }));
        expect(
            await screen.findByText(/could not reach the server/)
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Confirm email" })
        ).toBeEnabled();
        expect(where(router)).toBe("/verify-email");
    });
});

describe("VerifyEmailPage invalid links", () => {
    it("shows one generic message with a request-new-link form when the token is gone", async () => {
        track(() => errorResponse(400, "VERIFY_TOKEN_INVALID"));
        const user = userEvent.setup();
        const { container } = renderVerify();
        await user.click(screen.getByRole("button", { name: "Confirm email" }));
        expect(
            await screen.findByRole("heading", {
                name: "Link expired or already used",
            })
        ).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
            "href",
            "/login"
        );
        expect(
            screen.getByRole("button", { name: "Send a new link" })
        ).toBeInTheDocument();
        await expectAccessible(container);
    });

    it("shows the same screen without any request when the link has no token", () => {
        const bodies = track();
        renderVerify({ hash: "" });
        expect(
            screen.getByRole("heading", {
                name: "Link expired or already used",
            })
        ).toBeInTheDocument();
        expect(bodies).toHaveLength(0);
    });

    it("requests a new link with the neutral reply", async () => {
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
        const user = userEvent.setup();
        renderVerify({ hash: "" });
        await user.type(screen.getByLabelText("Email"), "Late@Example.Test");
        await user.click(
            screen.getByRole("button", { name: "Send a new link" })
        );
        expect(
            await screen.findByText(
                "If the address is pending verification, we sent a new link."
            )
        ).toBeInTheDocument();
        expect(resends).toEqual([{ email: "late@example.test" }]);
        expect(
            screen.getByRole("button", { name: /Resend in 60 s/ })
        ).toBeDisabled();
    });

    it("prefills the pending email when there is one", () => {
        renderVerify({
            hash: "",
            auth: { ...anonymousAuth, pendingEmail: "p@example.test" },
        });
        expect(screen.getByLabelText("Email")).toHaveValue("p@example.test");
    });

    it("tells a signed-in, verified visitor the email is already verified instead of consuming the link", () => {
        const bodies = track();
        renderVerify({ auth: signedInAuth({ emailVerified: true }) });
        expect(
            screen.getByRole("heading", { name: "Email already verified" })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Go to dashboard" })
        ).toHaveAttribute("href", "/dashboard");
        expect(bodies).toHaveLength(0);
    });
});

describe("VerifyEmailPage Hindi", () => {
    it("renders the confirm screen in Hindi", async () => {
        await i18n.changeLanguage("hi");
        const { container } = renderVerify();
        expect(
            screen.getByRole("button", { name: "ईमेल की पुष्टि करें" })
        ).toBeInTheDocument();
        await expectAccessible(container);
    });
});
