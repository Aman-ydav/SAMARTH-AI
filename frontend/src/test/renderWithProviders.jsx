import { render, renderHook } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { Provider } from "react-redux";
import { MemoryRouter, createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { setupStore } from "@/app/store";
import { i18n, loadAllNamespaces } from "@/i18n";

await loadAllNamespaces();

/**
 * Renders a component with a fresh store (never shared between tests, TEST-14), a memory router and i18n.
 * `preloadedState` is a partial slice map; build auth with the helpers in src/test/authState.js.
 */
export function renderWithProviders(
    ui,
    {
        preloadedState,
        store = setupStore(preloadedState),
        route = "/",
        ...options
    } = {}
) {
    function Wrapper({ children }) {
        return (
            <Provider store={store}>
                <I18nextProvider i18n={i18n}>
                    <MemoryRouter initialEntries={[route]}>
                        {children}
                    </MemoryRouter>
                </I18nextProvider>
            </Provider>
        );
    }
    return { store, ...render(ui, { wrapper: Wrapper, ...options }) };
}

/** Renders a route table (for example `routes` from app/routes.jsx) in a memory data router. */
export function renderRoutes(
    routes,
    {
        route = "/",
        preloadedState,
        store = setupStore(preloadedState),
        ...options
    } = {}
) {
    const router = createMemoryRouter(routes, { initialEntries: [route] });
    const result = render(
        <Provider store={store}>
            <I18nextProvider i18n={i18n}>
                <RouterProvider router={router} />
            </I18nextProvider>
        </Provider>,
        options
    );
    return { store, router, ...result };
}

/** Renders a hook inside the store, i18n and a memory router. Returns RTL's `renderHook` result plus the store. */
export function renderHookWithProviders(
    hook,
    {
        preloadedState,
        store = setupStore(preloadedState),
        route = "/",
        ...options
    } = {}
) {
    function Wrapper({ children }) {
        return (
            <Provider store={store}>
                <I18nextProvider i18n={i18n}>
                    <MemoryRouter initialEntries={[route]}>
                        {children}
                    </MemoryRouter>
                </I18nextProvider>
            </Provider>
        );
    }
    return { store, ...renderHook(hook, { wrapper: Wrapper, ...options }) };
}
