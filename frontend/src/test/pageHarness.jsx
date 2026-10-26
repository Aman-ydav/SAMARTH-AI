import { render } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { Provider } from "react-redux";
import { createMemoryRouter, parsePath } from "react-router";
import { RouterProvider } from "react-router/dom";
import { setupStore } from "@/app/store";
import { i18n, loadAllNamespaces } from "@/i18n";

await loadAllNamespaces();

/**
 * Renders one page inside a fresh store, i18n and a memory DATA router (pages that read route handles or
 * `useMatches` need one). Any other URL renders a marker with the destination path, so tests can assert
 * where a button or link navigated.
 *
 * - `path`: route pattern of the page (default `/page`); `entry`: URL opened (default `path`)
 * - `state`: navigation state of the opened entry; `history`: entries that precede it (enables "go back")
 * - `handle`: route handle (for example `{ title: "nav:sidebar.gaps" }`)
 */
export function renderPage(
    Page,
    {
        path = "/page",
        entry = path,
        state,
        history = [],
        handle,
        preloadedState,
        store = setupStore(preloadedState),
        ...options
    } = {}
) {
    const router = createMemoryRouter(
        [
            { path, element: <Page />, handle },
            {
                path: "*",
                element: <p data-testid="elsewhere">elsewhere</p>,
            },
        ],
        {
            initialEntries: [...history, { ...parsePath(entry), state }],
            initialIndex: history.length,
        }
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

/** Current pathname plus hash of the test router. */
export const currentLocation = (router) => {
    const { pathname, hash } = router.state.location;
    return `${pathname}${hash}`;
};
