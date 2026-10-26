const CHANNEL_NAME = "sai-auth";
const MESSAGE_TYPES = new Set(["login", "logout"]);

let channel = null;

function getChannel() {
    if (channel) return channel;
    if (typeof BroadcastChannel === "undefined") return null;
    try {
        channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
        channel = null;
    }
    return channel;
}

/** Tells the other tabs that this tab signed in or out. Carries only the type and a timestamp (FE-57). */
function post(type) {
    if (!MESSAGE_TYPES.has(type)) return false;
    const target = getChannel();
    if (!target) return false;
    try {
        target.postMessage({ type, at: Date.now() });
        return true;
    } catch {
        return false;
    }
}

/** Listens for sign-in or sign-out in other tabs; returns the unsubscribe function. */
function subscribe(handler) {
    const target = getChannel();
    if (!target) return () => {};
    const onMessage = (event) => {
        const type = event?.data?.type;
        if (MESSAGE_TYPES.has(type)) handler(type);
    };
    target.addEventListener("message", onMessage);
    return () => target.removeEventListener("message", onMessage);
}

function close() {
    if (!channel) return;
    try {
        channel.close();
    } finally {
        channel = null;
    }
}

export const authChannel = { post, subscribe, close };
