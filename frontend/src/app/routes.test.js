import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { routes } from "@/app/routes";
import { PATHS, PATH_ALIASES } from "@/lib/paths";
import { anonymousAuth, signedInAuth } from "@/test/authState";
import { renderRoutes } from "@/test/renderWithProviders";

const SAMPLE_ID = "64b7f0c2a1b2c3d4e5f60001";
const fill = (pattern) =>
    pattern.replace(":id", SAMPLE_ID).replace(":code", "ABC123");

const PUBLIC_NAMES = [
    "home",
    "about",
    "privacy",
    "terms",
    "getStarted",
    "login",
    "signup",
    "forgotPassword",
    "resetPassword",
    "verifyEmail",
    "verifyEmailSent",
    "confirmEmailChange",
    "undoEmailChange",
    "acceptInvite",
    "sessionExpired",
    "ssoCallback",
    "verifyCertificate",
    "unauthorized",
    "notFound",
    "serverError",
    "maintenance",
    "offline",
    "accountSuspended",
    "accountLocked",
    "accountDeactivated",
    "cookiesDisabled",
    "comingSoon",
];

const PUBLIC = PUBLIC_NAMES.map((name) => PATHS[name]);
const SIGNED_IN = Object.entries(PATHS)
    .filter(([name]) => !PUBLIC_NAMES.includes(name))
    .map(([, path]) => path);

/* The first lazy route in a file cold-loads its layout and page chunks (the landing page pulls in the motion library),
   which can take longer than the 1 s lookup default and the 5 s test default on a loaded machine. */
const COLD_LOAD_MS = 30_000;
const heading = () =>
    screen.findByRole("heading", { level: 1 }, { timeout: 20_000 });

describe("route table smoke test: every route resolves to a page", () => {
    it.each(PUBLIC)(
        "anonymous visitor can open %s",
        async (path) => {
            renderRoutes(routes, {
                route: fill(path),
                preloadedState: { auth: anonymousAuth },
            });
            expect((await heading()).textContent.length).toBeGreaterThan(0);
        },
        COLD_LOAD_MS
    );

    it.each(SIGNED_IN)("a signed-in superadmin can open %s", async (path) => {
        const state =
            path === PATHS.changePassword
                ? signedInAuth({ role: "superadmin", mustChangePassword: true })
                : signedInAuth({ role: "superadmin" });
        renderRoutes(routes, {
            route: fill(path),
            preloadedState: { auth: state },
        });
        expect((await heading()).textContent.length).toBeGreaterThan(0);
    });
});

describe("aliases, catch-all and redirects", () => {
    it.each(Object.entries(PATH_ALIASES))(
        "%s redirects to %s",
        async (from, to) => {
            const { router } = renderRoutes(routes, {
                route: from,
                preloadedState: { auth: anonymousAuth },
            });
            await heading();
            expect(router.state.location.pathname).toBe(to);
        }
    );

    it("renders the not-found page for unknown routes", async () => {
        renderRoutes(routes, {
            route: "/definitely/not/here",
            preloadedState: { auth: anonymousAuth },
        });
        expect(
            await screen.findByRole("heading", {
                level: 1,
                name: "Page not found",
            })
        ).toBeInTheDocument();
    });

    it("sends an anonymous visitor from a protected route to /login with the return path", async () => {
        const { router } = renderRoutes(routes, {
            route: "/gaps",
            preloadedState: { auth: anonymousAuth },
        });
        expect(
            await screen.findByRole("heading", {
                level: 1,
                name: "Welcome back",
            })
        ).toBeInTheDocument();
        expect(router.state.location.pathname).toBe("/login");
        expect(router.state.location.state).toEqual({ returnTo: "/gaps" });
    });

    it("sends a signed-in user away from /login", async () => {
        const { router } = renderRoutes(routes, {
            route: "/login",
            preloadedState: { auth: signedInAuth() },
        });
        await heading();
        expect(router.state.location.pathname).toBe("/dashboard");
    });

    it.each([
        ["learner", PATHS.admin],
        ["learner", PATHS.trainerContent],
        ["trainer", PATHS.admin],
        ["admin", PATHS.superadminSystem],
        ["trainer", PATHS.superadminOrganisations],
    ])("sends a %s who opens %s to /unauthorized", async (role, path) => {
        const { router } = renderRoutes(routes, {
            route: path,
            preloadedState: { auth: signedInAuth({ role }) },
        });
        expect(
            await screen.findByRole("heading", {
                level: 1,
                name: "You do not have access",
            })
        ).toBeInTheDocument();
        expect(router.state.location.pathname).toBe("/unauthorized");
    });

    it("keeps email-link pages open for signed-in users (no guest redirect)", async () => {
        const { router } = renderRoutes(routes, {
            route: PATHS.resetPassword,
            preloadedState: { auth: signedInAuth() },
        });
        await heading();
        expect(router.state.location.pathname).toBe(PATHS.resetPassword);
    });

    it("redirects forgot-password to the security settings for signed-in users", async () => {
        const { router } = renderRoutes(routes, {
            route: PATHS.forgotPassword,
            preloadedState: { auth: signedInAuth() },
        });
        await heading();
        expect(router.state.location.pathname).toBe(PATHS.settingsSecurity);
    });

    it("sends a limited session to /change-password", async () => {
        const { router } = renderRoutes(routes, {
            route: "/dashboard",
            preloadedState: {
                auth: { ...anonymousAuth, limitedSession: true },
            },
        });
        await heading();
        expect(router.state.location.pathname).toBe("/change-password");
    });

    it("sends a user who needs onboarding to /onboarding", async () => {
        const { router } = renderRoutes(routes, {
            route: "/dashboard",
            preloadedState: { auth: signedInAuth({ needsOnboarding: true }) },
        });
        await heading();
        expect(router.state.location.pathname).toBe("/onboarding");
    });

    it("keeps aliases out of the canonical route list", () => {
        for (const [from, to] of Object.entries(PATH_ALIASES)) {
            expect(Object.values(PATHS)).toContain(to);
            expect(Object.values(PATHS)).not.toContain(from);
        }
    });
});

describe("route layouts", () => {
    const MARKETING_SAMPLE = [
        "/",
        "/about",
        "/privacy",
        "/get-started",
        "/not-found",
    ];
    const SHELL_SAMPLE = ["/dashboard", "/gaps", "/labs", "/admin/users"];

    const appNav = () =>
        screen.queryByRole("navigation", { name: "App navigation" });
    const mainNav = () =>
        screen.queryByRole("navigation", { name: "Main navigation" });

    it.each(MARKETING_SAMPLE)(
        "%s is framed by the marketing navbar and footer",
        async (path) => {
            renderRoutes(routes, {
                route: path,
                preloadedState: { auth: anonymousAuth },
            });
            await heading();
            expect(mainNav()).toBeInTheDocument();
            const sitewide = screen
                .getAllByRole("contentinfo")
                .filter((footer) => !footer.closest("main"));
            expect(sitewide).toHaveLength(1);
            expect(appNav()).not.toBeInTheDocument();
        }
    );

    it.each(SHELL_SAMPLE)(
        "%s is framed by the app shell for a signed-in user",
        async (path) => {
            renderRoutes(routes, {
                route: path,
                preloadedState: { auth: signedInAuth({ role: "superadmin" }) },
            });
            await heading();
            expect(appNav()).toBeInTheDocument();
            expect(
                screen.getByRole("navigation", { name: "Breadcrumb" })
            ).toBeInTheDocument();
            expect(mainNav()).not.toBeInTheDocument();
            expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
        }
    );

    it.each([...MARKETING_SAMPLE, ...SHELL_SAMPLE])(
        "%s has exactly one main landmark with id main-content",
        async (path) => {
            renderRoutes(routes, {
                route: path,
                preloadedState: { auth: signedInAuth({ role: "superadmin" }) },
            });
            await heading();
            const mains = screen.getAllByRole("main");
            expect(mains).toHaveLength(1);
            expect(mains[0]).toHaveAttribute("id", "main-content");
            expect(document.querySelectorAll("#main-content")).toHaveLength(1);
        }
    );

    it("keeps the sign-in page out of the marketing frame", async () => {
        renderRoutes(routes, {
            route: "/login",
            preloadedState: { auth: anonymousAuth },
        });
        await heading();
        expect(mainNav()).not.toBeInTheDocument();
        expect(appNav()).not.toBeInTheDocument();
    });

    it("shows a signed-in learner no administrative links in the shell", async () => {
        renderRoutes(routes, {
            route: "/dashboard",
            preloadedState: { auth: signedInAuth({ role: "learner" }) },
        });
        await heading();
        const links = within(appNav())
            .getAllByRole("link")
            .map((link) => link.getAttribute("href"));
        expect(links).toContain("/gaps");
        expect(
            links.some((href) => /^\/(admin|superadmin|trainer)/.test(href))
        ).toBe(false);
    });

    it("renders the real dashboard welcome for the signed-in user", async () => {
        renderRoutes(routes, {
            route: "/dashboard",
            preloadedState: { auth: signedInAuth({ name: "Asha Verma" }) },
        });
        expect(
            await screen.findByRole("heading", {
                level: 1,
                name: "Welcome, Asha Verma",
            })
        ).toBeInTheDocument();
    });
});
