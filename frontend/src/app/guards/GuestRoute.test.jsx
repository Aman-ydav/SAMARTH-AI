import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GuestRoute } from "@/app/guards/GuestRoute";
import { anonymousAuth, signedInAuth } from "@/test/authState";
import { renderRoutes } from "@/test/renderWithProviders";

function routesFor(guardProps = {}) {
    return [
        {
            element: <GuestRoute {...guardProps} />,
            children: [{ path: "/login", element: <p>login page</p> }],
        },
        { path: "/dashboard", element: <p>dashboard page</p> },
        { path: "/gaps", element: <p>gaps page</p> },
        { path: "/onboarding", element: <p>onboarding page</p> },
        { path: "/change-password", element: <p>change password page</p> },
        { path: "/settings/security", element: <p>security page</p> },
    ];
}

function render(auth, { entry = "/login", guardProps } = {}) {
    return renderRoutes(routesFor(guardProps), {
        route: entry,
        preloadedState: { auth },
    });
}

describe("GuestRoute", () => {
    it("renders nothing until hydrated", () => {
        const { container } = render({ ...anonymousAuth, bootstrapped: false });
        expect(container).toBeEmptyDOMElement();
    });

    it("shows the page to an anonymous visitor", async () => {
        render(anonymousAuth);
        expect(await screen.findByText("login page")).toBeInTheDocument();
    });

    it("sends a signed-in user to the dashboard", async () => {
        render(signedInAuth());
        expect(await screen.findByText("dashboard page")).toBeInTheDocument();
    });

    it("sends a user who needs onboarding to /onboarding", async () => {
        render(signedInAuth({ needsOnboarding: true }));
        expect(await screen.findByText("onboarding page")).toBeInTheDocument();
    });

    it("sends a user who must change the password to /change-password", async () => {
        render(signedInAuth({ mustChangePassword: true }));
        expect(
            await screen.findByText("change password page")
        ).toBeInTheDocument();
    });

    it("honours a safe return path from the query string", async () => {
        render(signedInAuth(), { entry: "/login?returnTo=%2Fgaps" });
        expect(await screen.findByText("gaps page")).toBeInTheDocument();
    });

    it.each([
        "//evil.example.test",
        "https%3A%2F%2Fevil.example.test",
        "%2F%5Cevil.example.test",
    ])("ignores the unsafe return path %s", async (target) => {
        render(signedInAuth(), { entry: `/login?returnTo=${target}` });
        expect(await screen.findByText("dashboard page")).toBeInTheDocument();
    });

    it("supports a custom redirect target (forgot-password sends users to settings)", async () => {
        render(signedInAuth(), {
            guardProps: { signedInTo: "/settings/security" },
        });
        expect(await screen.findByText("security page")).toBeInTheDocument();
    });

    it("stays out of the way while a reactivation confirm screen is pending", async () => {
        render(signedInAuth({}, { reactivated: true }));
        expect(await screen.findByText("login page")).toBeInTheDocument();
    });
});
