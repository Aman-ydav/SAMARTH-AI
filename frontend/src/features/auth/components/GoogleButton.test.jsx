import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleButton } from "@/features/auth/components/GoogleButton";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { makeSessionData } from "@/mocks/fixtures/user";
import { anonymousAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { setMotionTier } from "@/test/motionTier";
import { renderAuthPage } from "@/test/renderAuthPage";

const mocks = vi.hoisted(() => ({
    env: { googleEnabled: true, googleClientId: "client-id.example.test" },
    providerProps: [],
    loginProps: [],
}));

vi.mock("@/lib/env", async (importOriginal) => {
    const actual = await importOriginal();
    Object.assign(mocks.env, actual.env);
    return { env: mocks.env };
});

vi.mock("@react-oauth/google", () => ({
    GoogleOAuthProvider: (props) => {
        mocks.providerProps.push(props);
        return <div data-testid="google-provider">{props.children}</div>;
    },
    GoogleLogin: (props) => {
        mocks.loginProps.push(props);
        return (
            <div>
                <button
                    type="button"
                    onClick={() => props.onSuccess({ credential: "cred-1" })}
                >
                    fake google ok
                </button>
                <button type="button" onClick={() => props.onSuccess({})}>
                    fake google empty
                </button>
                <button type="button" onClick={() => props.onError()}>
                    fake google error
                </button>
            </div>
        );
    },
}));

const server = setupMockServer();
const googleUrl = apiUrl("/auth/google");

beforeEach(() => {
    setMotionTier("reduced");
    Object.assign(mocks.env, {
        googleEnabled: true,
        googleClientId: "client-id.example.test",
    });
    mocks.providerProps.length = 0;
    mocks.loginProps.length = 0;
});

function renderGoogle(props = {}) {
    const onSession = vi.fn();
    const onFailure = vi.fn(() => false);
    const result = renderAuthPage(
        <GoogleButton onSession={onSession} onFailure={onFailure} {...props} />,
        { path: "/login", preloadedState: { auth: anonymousAuth } }
    );
    return { onSession, onFailure, ...result };
}

describe("GoogleButton disabled path", () => {
    it("renders nothing and never mounts the Google provider without a client id", () => {
        Object.assign(mocks.env, { googleEnabled: false, googleClientId: "" });
        renderGoogle();
        expect(screen.queryByTestId("google-provider")).not.toBeInTheDocument();
        expect(
            screen.queryByRole("group", { name: "Sign in with Google" })
        ).not.toBeInTheDocument();
        expect(mocks.providerProps).toHaveLength(0);
    });
});

describe("GoogleButton enabled path", () => {
    it("mounts the provider with the client id and asks for a nonce-bound credential", () => {
        renderGoogle();
        expect(screen.getByTestId("google-provider")).toBeInTheDocument();
        expect(mocks.providerProps[0].clientId).toBe("client-id.example.test");
        expect(mocks.loginProps[0].nonce).toMatch(/^[0-9a-f]{32}$/);
        expect(mocks.loginProps[0].text).toBe("continue_with");
    });

    it("posts the untouched credential with its nonce and hands the session on", async () => {
        const bodies = [];
        server.use(
            http.post(googleUrl, async ({ request }) => {
                bodies.push(await request.clone().json());
                return okResponse(makeSessionData());
            })
        );
        const user = userEvent.setup();
        const { onSession } = renderGoogle();
        await user.click(
            screen.getByRole("button", { name: "fake google ok" })
        );
        await waitFor(() => expect(onSession).toHaveBeenCalledTimes(1));
        expect(bodies[0]).toEqual({
            credential: "cred-1",
            nonce: mocks.loginProps[0].nonce,
        });
        expect(onSession.mock.calls[0][0].user.email).toBe(
            "asha.verma@example.test"
        );
    });

    it("adds reactivate: true when asked to", async () => {
        const bodies = [];
        server.use(
            http.post(googleUrl, async ({ request }) => {
                bodies.push(await request.clone().json());
                return okResponse(makeSessionData());
            })
        );
        const user = userEvent.setup();
        renderGoogle({ reactivate: true });
        await user.click(
            screen.getByRole("button", { name: "fake google ok" })
        );
        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0].reactivate).toBe(true);
    });

    it("lets the caller route a status code and shows nothing extra when it handled it", async () => {
        server.use(
            http.post(googleUrl, () => errorResponse(403, "ACCOUNT_SUSPENDED"))
        );
        const user = userEvent.setup();
        const { onFailure } = renderGoogle({ onFailure: vi.fn(() => true) });
        await user.click(
            screen.getByRole("button", { name: "fake google ok" })
        );
        await waitFor(() =>
            expect(screen.queryByRole("status")).not.toBeInTheDocument()
        );
        expect(onFailure).not.toHaveBeenCalled();
        expect(
            screen.queryByText(/Google sign-in failed/)
        ).not.toBeInTheDocument();
    });

    it.each([
        [
            "GOOGLE_TOKEN_INVALID",
            401,
            "Google sign-in failed. Please try again.",
        ],
        ["GOOGLE_EMAIL_UNVERIFIED", 401, "Your Google email is not verified."],
        ["DOMAIN_NOT_ALLOWED", 403, "This email domain is not allowed."],
    ])("shows the message for %s", async (code, status, text) => {
        server.use(http.post(googleUrl, () => errorResponse(status, code)));
        const user = userEvent.setup();
        renderGoogle();
        await user.click(
            screen.getByRole("button", { name: "fake google ok" })
        );
        expect(await screen.findByText(text)).toBeInTheDocument();
    });

    it("explains a cancelled or closed popup and offers a retry that remounts the provider", async () => {
        const user = userEvent.setup();
        renderGoogle();
        await user.click(
            screen.getByRole("button", { name: "fake google error" })
        );
        expect(
            await screen.findByText(/cancelled or did not complete/)
        ).toBeInTheDocument();
        const before = mocks.providerProps.length;
        await user.click(
            screen.getByRole("button", { name: "Try Google sign-in again" })
        );
        expect(
            screen.queryByText(/cancelled or did not complete/)
        ).not.toBeInTheDocument();
        expect(mocks.providerProps.length).toBeGreaterThan(before);
    });

    it("treats a response without a credential as a failed attempt", async () => {
        const user = userEvent.setup();
        renderGoogle();
        await user.click(
            screen.getByRole("button", { name: "fake google empty" })
        );
        expect(
            await screen.findByText(/cancelled or did not complete/)
        ).toBeInTheDocument();
    });

    it("explains a blocked Google script and keeps password sign-in available", async () => {
        renderGoogle();
        mocks.providerProps[0].onScriptLoadError();
        expect(
            await screen.findByText(/Google sign-in could not load/)
        ).toBeInTheDocument();
    });

    it("has no accessibility violations", async () => {
        const { container } = renderGoogle();
        await expectAccessible(container);
    });
});
