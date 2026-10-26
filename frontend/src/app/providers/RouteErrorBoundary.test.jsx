import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteErrorBoundary } from "@/app/providers/RouteErrorBoundary";
import { i18n } from "@/i18n";

afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
});

function Thrower({ error }) {
    throw error;
}

function renderBroken(error) {
    const fromLoader = error instanceof Response;
    const router = createMemoryRouter([
        {
            path: "/",
            loader: fromLoader
                ? () => {
                      throw error;
                  }
                : undefined,
            element: <Thrower error={error} />,
            errorElement: <RouteErrorBoundary />,
        },
    ]);
    return render(
        <I18nextProvider i18n={i18n}>
            <RouterProvider router={router} />
        </I18nextProvider>
    );
}

describe("RouteErrorBoundary", () => {
    it("shows the 404 view with a link home for a missing resource", async () => {
        renderBroken(new Response("", { status: 404 }));
        expect(
            await screen.findByRole("heading", {
                level: 1,
                name: "Page not found",
            })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Go to home" })
        ).toHaveAttribute("href", "/");
    });

    it("shows the 403 view with a way to the dashboard", async () => {
        renderBroken(new Response("", { status: 403 }));
        expect(
            await screen.findByRole("heading", {
                level: 1,
                name: "You do not have access",
            })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Go to dashboard" })
        ).toHaveAttribute("href", "/dashboard");
    });

    it("shows a generic crash view for unexpected errors without leaking the message", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        renderBroken(new Error("secret stack detail"));
        expect(
            await screen.findByRole("heading", {
                level: 1,
                name: "Something went wrong",
            })
        ).toBeInTheDocument();
        expect(
            screen.queryByText(/secret stack detail/)
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Go to home" })
        ).toBeInTheDocument();
    });

    it("shows the request id when the error carries one", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        renderBroken(Object.assign(new Error("boom"), { requestId: "req-77" }));
        expect(
            await screen.findByText("Request ID: req-77")
        ).toBeInTheDocument();
    });

    it("reloads once for a failed dynamic import, then offers a manual reload", async () => {
        const reload = vi.fn();
        vi.stubGlobal("location", { ...window.location, reload });
        const chunkError = new TypeError(
            "Failed to fetch dynamically imported module: /assets/Page-abc.js"
        );

        const first = renderBroken(chunkError);
        expect(reload).toHaveBeenCalledTimes(1);
        expect(sessionStorage.getItem("sai-chunk-reload")).toBe("1");
        first.unmount();

        renderBroken(chunkError);
        expect(
            await screen.findByRole("heading", {
                level: 1,
                name: "A new version is available",
            })
        ).toBeInTheDocument();
        expect(reload).toHaveBeenCalledTimes(1);
        screen.getByRole("button", { name: "Reload page" }).click();
        expect(reload).toHaveBeenCalledTimes(2);
    });
});
