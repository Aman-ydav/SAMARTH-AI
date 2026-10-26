import { useCallback, useState } from "react";

/** True unless the browser says cookies are off. Anything unreadable counts as enabled (never block on a guess). */
export function readCookiesEnabled() {
    try {
        return globalThis.navigator?.cookieEnabled !== false;
    } catch {
        return true;
    }
}

/**
 * Cookie support detected from `navigator.cookieEnabled` only (FE-64). Writing a test cookie from JavaScript is
 * deliberately not done: the `no-document-cookie` check (FE-41) allows `document.cookie` in `lib/csrf.js` alone.
 * `recheck` re-reads the flag, for example after the user changes a browser setting and returns to the tab.
 */
export function useCookiesEnabled() {
    const [enabled, setEnabled] = useState(readCookiesEnabled);
    const recheck = useCallback(() => {
        const next = readCookiesEnabled();
        setEnabled(next);
        return next;
    }, []);
    return { enabled, recheck };
}
