import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoleRoute } from "@/app/guards/RoleRoute";
import { ROLE_SETS } from "@/lib/permissions";
import { anonymousAuth, signedInAuth } from "@/test/authState";
import { renderRoutes } from "@/test/renderWithProviders";

const routes = [
    { path: "/unauthorized", element: <p>unauthorized page</p> },
    {
        element: <RoleRoute roles={ROLE_SETS.admin} />,
        children: [{ path: "/admin", element: <p>admin page</p> }],
    },
    {
        element: <RoleRoute roles={ROLE_SETS.superadmin} />,
        children: [
            { path: "/superadmin/system", element: <p>superadmin page</p> },
        ],
    },
];

const render = (route, auth) =>
    renderRoutes(routes, { route, preloadedState: { auth } });

describe("RoleRoute", () => {
    it.each(["admin", "superadmin"])(
        "lets %s into the admin area",
        async (role) => {
            render("/admin", signedInAuth({ role }));
            expect(await screen.findByText("admin page")).toBeInTheDocument();
        }
    );

    it.each(["learner", "trainer"])(
        "sends a %s to /unauthorized",
        async (role) => {
            render("/admin", signedInAuth({ role }));
            expect(
                await screen.findByText("unauthorized page")
            ).toBeInTheDocument();
        }
    );

    it("does not imply a hierarchy: an admin cannot open superadmin-only routes", async () => {
        render("/superadmin/system", signedInAuth({ role: "admin" }));
        expect(
            await screen.findByText("unauthorized page")
        ).toBeInTheDocument();
    });

    it("sends an unknown role to /unauthorized", async () => {
        render("/admin", signedInAuth({ role: "root" }));
        expect(
            await screen.findByText("unauthorized page")
        ).toBeInTheDocument();
    });

    it("renders nothing for an anonymous visitor (the surrounding ProtectedRoute decides)", () => {
        const { container } = render("/admin", anonymousAuth);
        expect(container).toBeEmptyDOMElement();
    });

    it("reacts when the role changes underneath the page", async () => {
        const { store } = render("/admin", signedInAuth({ role: "admin" }));
        expect(await screen.findByText("admin page")).toBeInTheDocument();
        const { userPatched } = await import("@/features/auth");
        store.dispatch(userPatched({ role: "learner" }));
        expect(
            await screen.findByText("unauthorized page")
        ).toBeInTheDocument();
    });
});
