import { screen } from "@testing-library/react";
import { Outlet, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { ProtectedRoute } from "@/app/guards/ProtectedRoute";
import { anonymousAuth, signedInAuth } from "@/test/authState";
import { renderRoutes } from "@/test/renderWithProviders";

function Probe({ label }) {
    const location = useLocation();
    return (
        <div>
            <p>{label}</p>
            <p data-testid="state">{JSON.stringify(location.state)}</p>
        </div>
    );
}

const page = (label) => <Probe label={label} />;

function routesFor(guardProps) {
    return [
        { path: "/login", element: page("login page") },
        { path: "/session-expired", element: page("session expired page") },
        { path: "/change-password", element: page("change password page") },
        { path: "/onboarding", element: page("onboarding page") },
        {
            element: <ProtectedRoute {...guardProps} />,
            children: [
                { path: "/dashboard", element: page("dashboard page") },
                { path: "/courses/:id", element: page("course page") },
                { path: "/nested", element: <Outlet /> },
            ],
        },
    ];
}

const render = (route, auth, guardProps = {}) =>
    renderRoutes(routesFor(guardProps), { route, preloadedState: { auth } });

describe("ProtectedRoute", () => {
    it("renders nothing until the app has hydrated", () => {
        const { container } = render("/dashboard", {
            ...anonymousAuth,
            bootstrapped: false,
        });
        expect(container).toBeEmptyDOMElement();
    });

    it("lets a signed-in user through", async () => {
        render("/dashboard", signedInAuth());
        expect(await screen.findByText("dashboard page")).toBeInTheDocument();
    });

    it("sends an anonymous visitor to /login carrying only the path as return state", async () => {
        render("/courses/abc?tab=2", anonymousAuth);
        expect(await screen.findByText("login page")).toBeInTheDocument();
        expect(JSON.parse(screen.getByTestId("state").textContent)).toEqual({
            returnTo: "/courses/abc?tab=2",
        });
    });

    it("does not carry a return path after a deliberate logout", async () => {
        render("/dashboard", { ...anonymousAuth, sessionEnd: "LOGOUT" });
        expect(await screen.findByText("login page")).toBeInTheDocument();
        expect(screen.getByTestId("state").textContent).toBe("null");
    });

    it.each(["SESSION_EXPIRED", "SESSION_REVOKED", "LOGOUT_OTHER_TAB"])(
        "sends a %s visitor to /session-expired with a return path",
        async (sessionEnd) => {
            render("/dashboard", { ...anonymousAuth, sessionEnd });
            expect(
                await screen.findByText("session expired page")
            ).toBeInTheDocument();
            expect(JSON.parse(screen.getByTestId("state").textContent)).toEqual(
                { returnTo: "/dashboard" }
            );
        }
    );

    it("sends a limited (must-change-password) session without a user to /change-password", async () => {
        render("/dashboard", { ...anonymousAuth, limitedSession: true });
        expect(
            await screen.findByText("change password page")
        ).toBeInTheDocument();
    });

    it("lets the change-password route itself render for a limited session", async () => {
        render(
            "/dashboard",
            { ...anonymousAuth, limitedSession: true },
            { allowMustChange: true }
        );
        expect(await screen.findByText("dashboard page")).toBeInTheDocument();
    });

    it("forces a password change before anything else", async () => {
        render("/dashboard", signedInAuth({ mustChangePassword: true }));
        expect(
            await screen.findByText("change password page")
        ).toBeInTheDocument();
    });

    it("allows the change-password route for a user who must change it", async () => {
        render("/dashboard", signedInAuth({ mustChangePassword: true }), {
            allowMustChange: true,
        });
        expect(await screen.findByText("dashboard page")).toBeInTheDocument();
    });

    it("sends a user who needs onboarding to /onboarding", async () => {
        render("/dashboard", signedInAuth({ needsOnboarding: true }));
        expect(await screen.findByText("onboarding page")).toBeInTheDocument();
    });

    it("lets the onboarding route render and respects a skip", async () => {
        render("/dashboard", signedInAuth({ needsOnboarding: true }), {
            allowOnboarding: true,
        });
        expect(await screen.findByText("dashboard page")).toBeInTheDocument();
    });

    it("does not redirect again after onboarding was skipped", async () => {
        render(
            "/dashboard",
            signedInAuth({ needsOnboarding: true }, { onboardingSkipped: true })
        );
        expect(await screen.findByText("dashboard page")).toBeInTheDocument();
    });

    it("does not keep an unsafe or non-returnable current location as the return path", async () => {
        render("/nested", anonymousAuth);
        expect(await screen.findByText("login page")).toBeInTheDocument();
        expect(screen.getByTestId("state").textContent).toBe("null");
    });
});
