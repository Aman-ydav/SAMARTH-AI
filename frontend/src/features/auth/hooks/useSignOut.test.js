import { act, waitFor } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { useSignOut } from "@/features/auth/hooks/useSignOut";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { signedInAuth } from "@/test/authState";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { renderHookWithProviders } from "@/test/renderWithProviders";

const server = setupMockServer();
const render = () =>
    renderHookWithProviders(() => useSignOut(), {
        preloadedState: { auth: signedInAuth() },
    });

describe("useSignOut", () => {
    it("ends the session on success and is idle again afterwards", async () => {
        const { result, store } = render();
        expect(result.current.pending).toBeNull();
        await act(() => result.current.signOut());
        expect(store.getState().auth.user).toBeNull();
        await waitFor(() => expect(result.current.pending).toBeNull());
    });

    it("signs out of all devices", async () => {
        let called = 0;
        server.use(
            http.post(apiUrl("/auth/logout-all"), () => {
                called += 1;
                return okResponse(null);
            })
        );
        const { result, store } = render();
        await act(() => result.current.signOutEverywhere());
        expect(called).toBe(1);
        expect(store.getState().auth.user).toBeNull();
    });

    it("keeps the user signed in when the server fails (logout never lies)", async () => {
        server.use(
            http.post(apiUrl("/auth/logout"), () =>
                errorResponse(503, "SERVER_ERROR")
            )
        );
        const { result, store } = render();
        await act(() => result.current.signOut());
        expect(store.getState().auth.user).not.toBeNull();
        expect(result.current.pending).toBeNull();
    });

    it("treats an already-ended session (401) as signed out", async () => {
        server.use(
            http.post(apiUrl("/auth/logout"), () =>
                errorResponse(401, "SESSION_REVOKED")
            )
        );
        const { result, store } = render();
        await act(() => result.current.signOut());
        expect(store.getState().auth.user).toBeNull();
    });

    it("ignores a second call while one is in flight (double submit)", async () => {
        let calls = 0;
        server.use(
            http.post(apiUrl("/auth/logout"), async () => {
                calls += 1;
                await new Promise((resolve) => setTimeout(resolve, 20));
                return okResponse(null);
            })
        );
        const { result } = render();
        await act(async () => {
            const first = result.current.signOut();
            const second = result.current.signOut();
            await Promise.all([first, second]);
        });
        expect(calls).toBe(1);
    });
});
