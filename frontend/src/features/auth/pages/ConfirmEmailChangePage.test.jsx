import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ConfirmEmailChangePage from "@/features/auth/pages/ConfirmEmailChangePage";
import { i18n } from "@/i18n";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { makeUser } from "@/mocks/fixtures/user";
import { anonymousAuth, signedInAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { setMotionTier } from "@/test/motionTier";
import { renderAuthPage } from "@/test/renderAuthPage";

const server = setupMockServer();
const confirmUrl = apiUrl("/auth/change-email/confirm");
const TOKEN = "tok-confirm-0123456789";

beforeEach(() => setMotionTier("reduced"));
afterEach(async () => {
    window.history.replaceState(null, "", "/");
    await i18n.changeLanguage("en");
});

function track(response = () => okResponse({ emailChanged: true })) {
    const bodies = [];
    server.use(
        http.post(confirmUrl, async ({ request }) => {
            bodies.push(await request.clone().json());
            return response();
        })
    );
    return bodies;
}

function renderConfirm({
    hash = `#token=${TOKEN}`,
    auth = anonymousAuth,
} = {}) {
    window.history.replaceState(null, "", `/confirm-email-change${hash}`);
    return renderAuthPage(<ConfirmEmailChangePage />, {
        path: "/confirm-email-change",
        entry: `/confirm-email-change${hash}`,
        preloadedState: { auth },
    });
}

const confirmButton = () =>
    screen.getByRole("button", { name: "Confirm new email" });

describe("ConfirmEmailChangePage confirm-then-POST", () => {
    it("shows a confirm button, strips the token and consumes nothing until it is pressed", async () => {
        const bodies = track();
        const { container } = renderConfirm();
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "Confirm your new email",
            })
        ).toBeInTheDocument();
        expect(confirmButton()).toBeEnabled();
        expect(window.location.hash).toBe("");
        expect(bodies).toHaveLength(0);
        await expectAccessible(container);
    });

    it("renders its own main landmark", () => {
        renderConfirm();
        expect(screen.getAllByRole("main")).toHaveLength(1);
        expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    });

    it("posts the token in the body on confirm and offers to log in when signed out", async () => {
        const bodies = track();
        const user = userEvent.setup();
        const { container, store } = renderConfirm();
        await user.click(confirmButton());
        expect(
            await screen.findByRole("heading", {
                name: "Email address updated",
            })
        ).toBeInTheDocument();
        expect(bodies).toEqual([{ token: TOKEN }]);
        expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
            "href",
            "/login"
        );
        expect(JSON.stringify(store.getState())).not.toContain(TOKEN);
        await expectAccessible(container);
    });

    it("reads /auth/me again for a signed-in visitor so the new address shows at once", async () => {
        track();
        server.use(
            http.get(apiUrl("/auth/me"), () =>
                okResponse({
                    user: makeUser({ email: "new.address@example.test" }),
                })
            )
        );
        const user = userEvent.setup();
        const { store } = renderConfirm({ auth: signedInAuth() });
        await user.click(confirmButton());
        expect(
            await screen.findByRole("link", {
                name: "Go to security settings",
            })
        ).toHaveAttribute("href", "/settings/security");
        await waitFor(() =>
            expect(store.getState().auth.user.email).toBe(
                "new.address@example.test"
            )
        );
    });

    it("sends one request for a double click", async () => {
        const bodies = track();
        const user = userEvent.setup();
        renderConfirm();
        await user.dblClick(confirmButton());
        await screen.findByRole("heading", { name: "Email address updated" });
        expect(bodies).toHaveLength(1);
    });

    it("keeps the button for a retry after a network failure", async () => {
        server.use(http.post(confirmUrl, () => Response.error()));
        const user = userEvent.setup();
        renderConfirm();
        await user.click(confirmButton());
        expect(
            await screen.findByText(/could not reach the server/)
        ).toBeInTheDocument();
        expect(confirmButton()).toBeEnabled();
    });
});

describe("ConfirmEmailChangePage invalid links", () => {
    it("shows one generic message when the server says the link is invalid", async () => {
        track(() => errorResponse(400, "EMAIL_CHANGE_INVALID"));
        const user = userEvent.setup();
        const { container } = renderConfirm();
        await user.click(confirmButton());
        expect(
            await screen.findByRole("heading", {
                name: "Link expired or already used",
            })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Go to security settings" })
        ).toHaveAttribute("href", "/settings/security");
        expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
            "href",
            "/login"
        );
        await expectAccessible(container);
    });

    it("shows the same screen without any request when the link has no token", () => {
        const bodies = track();
        renderConfirm({ hash: "" });
        expect(
            screen.getByRole("heading", {
                name: "Link expired or already used",
            })
        ).toBeInTheDocument();
        expect(bodies).toHaveLength(0);
    });

    it("keeps the confirm screen for other failures such as a rate limit", async () => {
        track(() =>
            errorResponse(429, "RATE_LIMITED", {
                headers: { "Retry-After": "30" },
            })
        );
        const user = userEvent.setup();
        renderConfirm();
        await user.click(confirmButton());
        expect(
            await screen.findByText(/Too many requests/)
        ).toBeInTheDocument();
        expect(confirmButton()).toBeDisabled();
    });
});

describe("ConfirmEmailChangePage Hindi", () => {
    it("renders the confirm screen in Hindi", async () => {
        await i18n.changeLanguage("hi");
        const { container } = renderConfirm();
        expect(
            screen.getByRole("button", { name: "नए ईमेल की पुष्टि करें" })
        ).toBeInTheDocument();
        await expectAccessible(container);
    });
});
