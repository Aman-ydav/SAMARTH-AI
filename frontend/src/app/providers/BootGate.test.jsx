import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { BootGate } from "@/app/providers/BootGate";
import { fetchCurrentUser } from "@/features/auth";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { makeUser } from "@/mocks/fixtures/user";
import { anonymousAuth } from "@/test/authState";
import { renderWithProviders } from "@/test/renderWithProviders";
import { setupMockServer } from "@/test/mockServerLifecycle";

const server = setupMockServer();

const child = <p>app content</p>;

describe("BootGate", () => {
    it("shows a splash and hides the app until hydration finishes", () => {
        renderWithProviders(<BootGate>{child}</BootGate>);
        expect(screen.getByRole("status")).toBeInTheDocument();
        expect(screen.queryByText("app content")).not.toBeInTheDocument();
    });

    it("renders the app once bootstrapped, signed in or not", () => {
        renderWithProviders(<BootGate>{child}</BootGate>, {
            preloadedState: { auth: anonymousAuth },
        });
        expect(screen.getByText("app content")).toBeInTheDocument();
    });

    it("offers Retry after a transient boot failure and recovers", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout"], shouldAdvanceTime: true });
        server.use(
            http.get(apiUrl("/auth/me"), () =>
                errorResponse(503, "INTEGRATION_ERROR", {
                    requestId: "req-boot",
                })
            )
        );
        const { store } = renderWithProviders(<BootGate>{child}</BootGate>);
        const pending = store.dispatch(fetchCurrentUser());
        for (let step = 0; step < 30; step += 1)
            await vi.advanceTimersByTimeAsync(250);
        await pending;
        vi.useRealTimers();

        expect(
            await screen.findByRole("heading", {
                level: 1,
                name: "We could not start SAMARTH AI",
            })
        ).toBeInTheDocument();
        expect(screen.getByText("Request ID: req-boot")).toBeInTheDocument();
        expect(screen.queryByText("app content")).not.toBeInTheDocument();

        server.use(
            http.get(apiUrl("/auth/me"), () => okResponse({ user: makeUser() }))
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Try again" })
        );
        expect(await screen.findByText("app content")).toBeInTheDocument();
        expect(store.getState().auth.user).not.toBeNull();
    });
});
