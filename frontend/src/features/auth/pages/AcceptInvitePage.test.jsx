import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import AcceptInvitePage from "@/features/auth/pages/AcceptInvitePage";
import { i18n } from "@/i18n";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { makeSessionData } from "@/mocks/fixtures/user";
import { anonymousAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { setMotionTier } from "@/test/motionTier";
import { renderAuthPage, where } from "@/test/renderAuthPage";

const server = setupMockServer();
const inviteUrl = apiUrl("/auth/accept-invite");
const TOKEN = "tok-invite-0123456789";
const STRONG = "mango river lantern 42";

beforeEach(() => setMotionTier("reduced"));
afterEach(async () => {
    window.history.replaceState(null, "", "/");
    await i18n.changeLanguage("en");
});

function track(
    response = () =>
        okResponse(
            makeSessionData({ needsOnboarding: true }, { role: "trainer" })
        )
) {
    const bodies = [];
    server.use(
        http.post(inviteUrl, async ({ request }) => {
            bodies.push(await request.clone().json());
            return response();
        })
    );
    return bodies;
}

function renderInvite(hash = `#token=${TOKEN}`) {
    window.history.replaceState(null, "", `/accept-invite${hash}`);
    return renderAuthPage(<AcceptInvitePage />, {
        path: "/accept-invite",
        entry: `/accept-invite${hash}`,
        preloadedState: { auth: anonymousAuth },
    });
}

const field = (label) => screen.getByLabelText(label, { selector: "input" });

async function fill(
    user,
    { name = "Dr. Rao", password = STRONG, confirm = password } = {}
) {
    for (const [label, value] of [
        ["Full name", name],
        ["Password", password],
        ["Confirm password", confirm],
    ]) {
        if (!value) continue;
        await user.click(field(label));
        await user.paste(value);
    }
    await user.click(screen.getByRole("button", { name: "Join SAMARTH AI" }));
}

describe("AcceptInvitePage", () => {
    it("strips the fragment, shows the form and consumes nothing on open", async () => {
        const bodies = track();
        const { container } = renderInvite();
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "Accept your invitation",
            })
        ).toBeInTheDocument();
        expect(window.location.hash).toBe("");
        expect(bodies).toHaveLength(0);
        await expectAccessible(container);
    });

    it("posts the token, name and password only (no role) and continues to onboarding", async () => {
        const bodies = track();
        const user = userEvent.setup();
        const { router, store } = renderInvite();
        await fill(user);
        await waitFor(() => expect(where(router)).toBe("/onboarding"));
        expect(bodies).toEqual([
            { token: TOKEN, name: "Dr. Rao", password: STRONG },
        ]);
        expect(JSON.stringify(store.getState())).not.toContain(TOKEN);
        expect(store.getState().auth.user.role).toBe("trainer");
    });

    it("lists the problems in a summary and sends nothing for an invalid form", async () => {
        const bodies = track();
        const user = userEvent.setup();
        renderInvite();
        await fill(user, { name: "", password: "short", confirm: "other" });
        const summary = await screen.findByRole("group", {
            name: /problems with your entry/,
        });
        expect(
            within(summary).getAllByRole("link").length
        ).toBeGreaterThanOrEqual(2);
        await waitFor(() => expect(summary).toHaveFocus());
        expect(bodies).toHaveLength(0);
    });

    it("shows the generic invitation message for an expired, revoked or used invite", async () => {
        track(() => errorResponse(400, "INVITE_INVALID"));
        const user = userEvent.setup();
        renderInvite();
        await fill(user);
        expect(
            await screen.findByRole("heading", { name: "Invitation not valid" })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Go to log in" })
        ).toHaveAttribute("href", "/login");
        expect(
            screen.getByRole("link", { name: "Contact support" })
        ).toBeInTheDocument();
    });

    it("shows the same message at once when the link has no token", () => {
        const bodies = track();
        renderInvite("");
        expect(
            screen.getByRole("heading", { name: "Invitation not valid" })
        ).toBeInTheDocument();
        expect(bodies).toHaveLength(0);
    });

    it("maps PASSWORD_POLICY onto the password field", async () => {
        track(() => errorResponse(400, "PASSWORD_POLICY"));
        const user = userEvent.setup();
        renderInvite();
        await fill(user);
        expect(
            await screen.findByText(
                "This password does not meet the requirements."
            )
        ).toBeInTheDocument();
        await waitFor(() => expect(field("Password")).toHaveFocus());
    });

    it("renders in Hindi", async () => {
        await i18n.changeLanguage("hi");
        const { container } = renderInvite();
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "अपना आमंत्रण स्वीकार करें",
            })
        ).toBeInTheDocument();
        await expectAccessible(container);
    });
});
