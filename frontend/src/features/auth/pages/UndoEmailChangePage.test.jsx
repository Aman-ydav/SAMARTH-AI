import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import UndoEmailChangePage from "@/features/auth/pages/UndoEmailChangePage";
import { i18n } from "@/i18n";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { anonymousAuth, signedInAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { setMotionTier } from "@/test/motionTier";
import { renderAuthPage } from "@/test/renderAuthPage";

const server = setupMockServer();
const undoUrl = apiUrl("/auth/change-email/undo");
const TOKEN = "tok-undo-0123456789";

beforeEach(() => setMotionTier("reduced"));
afterEach(async () => {
    window.history.replaceState(null, "", "/");
    await i18n.changeLanguage("en");
});

function track(response = () => okResponse({ restored: true })) {
    const bodies = [];
    server.use(
        http.post(undoUrl, async ({ request }) => {
            bodies.push(await request.clone().json());
            return response();
        })
    );
    return bodies;
}

function renderUndo({ hash = `#token=${TOKEN}`, auth = anonymousAuth } = {}) {
    window.history.replaceState(null, "", `/undo-email-change${hash}`);
    return renderAuthPage(<UndoEmailChangePage />, {
        path: "/undo-email-change",
        entry: `/undo-email-change${hash}`,
        preloadedState: { auth },
    });
}

const undoButton = () =>
    screen.getByRole("button", { name: "Undo email change" });

describe("UndoEmailChangePage confirm-then-POST", () => {
    it("shows a confirm button, strips the token and consumes nothing until it is pressed", async () => {
        const bodies = track();
        const { container } = renderUndo();
        expect(
            screen.getByRole("heading", { level: 1, name: "Undo email change" })
        ).toBeInTheDocument();
        expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
        expect(window.location.hash).toBe("");
        expect(bodies).toHaveLength(0);
        await expectAccessible(container);
    });

    it("posts the token and explains that every device was logged out", async () => {
        const bodies = track();
        const user = userEvent.setup();
        const { container, store } = renderUndo();
        await user.click(undoButton());
        expect(
            await screen.findByRole("heading", {
                name: "Email change undone",
            })
        ).toBeInTheDocument();
        expect(bodies).toEqual([{ token: TOKEN }]);
        expect(
            screen.getByText(/every device was logged out/)
        ).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
            "href",
            "/login"
        );
        expect(JSON.stringify(store.getState())).not.toContain(TOKEN);
        await expectAccessible(container);
    });

    it("drops the local session of a signed-in visitor, since the server revoked them all", async () => {
        track();
        const user = userEvent.setup();
        const { store } = renderUndo({ auth: signedInAuth() });
        await user.click(undoButton());
        await screen.findByRole("heading", { name: "Email change undone" });
        expect(store.getState().auth.user).toBeNull();
    });

    it("sends one request for a double click", async () => {
        const bodies = track();
        const user = userEvent.setup();
        renderUndo();
        await user.dblClick(undoButton());
        await screen.findByRole("heading", { name: "Email change undone" });
        expect(bodies).toHaveLength(1);
    });

    it("keeps the button for a retry after a server failure", async () => {
        track(() => errorResponse(500, "INTERNAL", { requestId: "req-77" }));
        const user = userEvent.setup();
        renderUndo();
        await user.click(undoButton());
        expect(
            await screen.findByText("req-77", { exact: false })
        ).toBeInTheDocument();
        expect(undoButton()).toBeEnabled();
    });
});

describe("UndoEmailChangePage invalid links", () => {
    it("shows one generic message when the link is expired or used", async () => {
        track(() => errorResponse(400, "EMAIL_CHANGE_INVALID"));
        const user = userEvent.setup();
        const { container } = renderUndo();
        await user.click(undoButton());
        expect(
            await screen.findByRole("heading", {
                name: "Link expired or already used",
            })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Reset password" })
        ).toHaveAttribute("href", "/forgot-password");
        await expectAccessible(container);
    });

    it("shows the same screen without any request when the link has no token", () => {
        const bodies = track();
        renderUndo({ hash: "" });
        expect(
            screen.getByRole("heading", {
                name: "Link expired or already used",
            })
        ).toBeInTheDocument();
        expect(bodies).toHaveLength(0);
    });
});

describe("UndoEmailChangePage Hindi", () => {
    it("renders the confirm screen in Hindi", async () => {
        await i18n.changeLanguage("hi");
        const { container } = renderUndo();
        expect(
            screen.getByRole("button", { name: "ईमेल बदलाव वापस करें" })
        ).toBeInTheDocument();
        await expectAccessible(container);
    });
});
