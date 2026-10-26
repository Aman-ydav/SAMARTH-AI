import { configureStore, createListenerMiddleware } from "@reduxjs/toolkit";
import { registerListeners } from "@/app/listeners";
import { rootReducer } from "@/app/rootReducer";
import { env } from "@/lib/env";

const SECRET_KEYS =
    /^(?:password|newPassword|currentPassword|confirmPassword|token|credential|otp|csrf\w*|idToken)$/;
const REDACTED = "[redacted]";

function redact(value, depth = 0) {
    if (!value || typeof value !== "object" || depth > 4) return value;
    if (Array.isArray(value))
        return value.map((item) => redact(item, depth + 1));
    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
            key,
            SECRET_KEYS.test(key) ? REDACTED : redact(item, depth + 1),
        ])
    );
}

/* Redux devtools run in development only, with secrets stripped from what they record (FE-14). */
const devToolsOptions = {
    actionSanitizer: (action) => ({
        ...action,
        payload: redact(action.payload),
        meta: redact(action.meta),
    }),
};

/** Builds a fresh store. Production code calls it once; tests call it per test with optional preloaded state (FE-08, FE-15). */
export function setupStore(preloadedState) {
    const listenerMiddleware = createListenerMiddleware();
    registerListeners(listenerMiddleware.startListening);
    return configureStore({
        reducer: rootReducer,
        preloadedState,
        middleware: (getDefaultMiddleware) =>
            getDefaultMiddleware().prepend(listenerMiddleware.middleware),
        devTools: env.isDev ? devToolsOptions : false,
    });
}

export const store = setupStore();
