import { setRouterBridge } from "@/app/listeners";
import { fetchCurrentUser, sessionExpired } from "@/features/auth";
import {
    applyTheme,
    offlineChanged,
    serverWakingChanged,
} from "@/features/preferences";
import { API_EVENTS, apiEvents } from "@/lib/apiEvents";
import { authChannel } from "@/lib/authChannel";
import { logger } from "@/lib/logger";

/** React 19 root callbacks (FE-110): log only, never toast. */
export const rootErrorHandlers = {
    onUncaughtError: (error, info) =>
        logger.error("Uncaught render error", {
            name: error?.name,
            event: info?.componentStack ? "component" : "unknown",
        }),
    onCaughtError: (error) =>
        logger.warn("Render error caught by a boundary", { name: error?.name }),
    onRecoverableError: (error) =>
        logger.warn("Recoverable render error", { name: error?.name }),
};

function registerWindowHandlers(store) {
    const handlers = [
        [
            "error",
            (event) =>
                logger.error("Window error", { name: event?.error?.name }),
        ],
        [
            "unhandledrejection",
            (event) =>
                logger.error("Unhandled rejection", {
                    name: event?.reason?.name,
                }),
        ],
        ["online", () => store.dispatch(offlineChanged(false))],
        ["offline", () => store.dispatch(offlineChanged(true))],
        [
            "pageshow",
            (event) => {
                if (event.persisted)
                    store.dispatch(fetchCurrentUser({ force: true }));
            },
        ],
    ];
    for (const [type, handler] of handlers)
        window.addEventListener(type, handler);
    return () => {
        for (const [type, handler] of handlers)
            window.removeEventListener(type, handler);
    };
}

/**
 * Hydrates the app before the first render (FE-53): wires the router into listeners, subscribes to apiClient
 * events and cross-tab messages, then dispatches `fetchCurrentUser` outside React. The R5 flow (one refresh,
 * one retry) lives in the apiClient; an anonymous visitor is a normal result, a transient failure is not.
 * Returns `{ hydrated, dispose }`.
 */
export function bootstrapApp({ store, router }) {
    applyTheme(store.getState().ui.theme);
    setRouterBridge({
        navigate: (to, options) => router.navigate(to, options),
        getLocation: () => router.state.location,
    });
    store.dispatch(
        offlineChanged(
            typeof navigator !== "undefined" && navigator.onLine === false
        )
    );

    const unsubscribers = [
        apiEvents.on(API_EVENTS.SESSION_EXPIRED, ({ reason }) =>
            store.dispatch(sessionExpired(reason))
        ),
        apiEvents.on(API_EVENTS.SERVER_WAKING, ({ active }) =>
            store.dispatch(serverWakingChanged(active))
        ),
        authChannel.subscribe((type) => {
            if (type === "logout")
                store.dispatch(sessionExpired("LOGOUT_OTHER_TAB"));
            else store.dispatch(fetchCurrentUser({ force: true }));
        }),
        registerWindowHandlers(store),
    ];

    const hydrated = store.dispatch(fetchCurrentUser());
    return {
        hydrated,
        dispose: () => {
            for (const unsubscribe of unsubscribers) unsubscribe();
            setRouterBridge({});
        },
    };
}
