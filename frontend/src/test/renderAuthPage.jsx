import { render } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { Provider } from "react-redux";
import { createMemoryRouter, parsePath } from "react-router";
import { RouterProvider } from "react-router/dom";
import { setupStore } from "@/app/store";
import { AuthSplitLayout } from "@/components/layout/AuthSplitLayout";
import { i18n, loadAllNamespaces } from "@/i18n";

await loadAllNamespaces();

/**
 * Renders an auth page (or form) inside the real `AuthSplitLayout`, a fresh store, i18n and a memory data router.
 * Any other URL renders a marker, so tests assert where a button, link or redirect went with `router.state.location`.
 *
 * - `path`: route pattern of the page (default `/page`); `entry`: URL opened, may carry a `#fragment`
 * - `state`: router state of the opened entry (for example `{ returnTo }` or `{ notice }`)
 * - `layout: false` renders the element without the layout frame
 */
export function renderAuthPage(
    element,
    {
        path = "/page",
        entry = path,
        state,
        layout = true,
        preloadedState,
        store = setupStore(preloadedState),
        ...options
    } = {}
) {
    const page = { path, element };
    const router = createMemoryRouter(
        [
            layout ? { element: <AuthSplitLayout />, children: [page] } : page,
            {
                path: "*",
                element: <p data-testid="elsewhere">elsewhere</p>,
            },
        ],
        { initialEntries: [{ ...parsePath(entry), state }] }
    );
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

/** `pathname` plus `search` of the test router's current location. */
export const where = (router) => {
    const { pathname, search } = router.state.location;
    return `${pathname}${search}`;
};
