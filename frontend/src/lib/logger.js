const ALLOWED_CONTEXT_KEYS = [
    "route",
    "code",
    "status",
    "requestId",
    "thunk",
    "name",
    "event",
];

const isDevMode = () => {
    try {
        return Boolean(import.meta.env?.DEV);
    } catch {
        return false;
    }
};

function pickContext(context) {
    if (!context || typeof context !== "object") return {};
    const safe = {};
    for (const key of ALLOWED_CONTEXT_KEYS) {
        const value = context[key];
        if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
        ) {
            safe[key] = value;
        }
    }
    return safe;
}

function emit(level, message, context) {
    const sink = globalThis.console;
    if (!sink || typeof sink[level] !== "function") return;
    sink[level](`[samarth] ${String(message)}`, pickContext(context));
}

/**
 * Logging facade. The only place in the app that touches the console (FE-109).
 * Context is allow-listed to non-PII keys; request or response bodies, emails and tokens never pass through.
 */
export const logger = {
    debug(message, context) {
        if (isDevMode()) emit("debug", message, context);
    },
    info(message, context) {
        if (isDevMode()) emit("info", message, context);
    },
    warn(message, context) {
        emit("warn", message, context);
    },
    error(message, context) {
        emit("error", message, context);
    },
};
