import { useEffect, useState } from "react";
import { useLocation } from "react-router";

const MAX_TOKEN_LENGTH = 512;

/** Reads `token` from a `#a=b&token=c` fragment without turning `+` into a space. */
function readToken(hash) {
    const fragment = String(hash ?? "").replace(/^#/, "");
    for (const pair of fragment.split("&")) {
        const separator = pair.indexOf("=");
        if (separator === -1 || pair.slice(0, separator) !== "token") continue;
        let value = pair.slice(separator + 1);
        try {
            value = decodeURIComponent(value);
        } catch {
            return null;
        }
        return value.length > 0 && value.length <= MAX_TOKEN_LENGTH
            ? value
            : null;
    }
    return null;
}

/**
 * One-time email tokens (verify, reset, invite) travel in the URL fragment (R2, AUTH-31, FE-61).
 * The fragment is read once when the page mounts, stripped from the address bar with
 * `history.replaceState` at once, and the token lives only in this component's state
 * (never Redux, storage, logs or a toast). Opening the link never consumes the token.
 */
export function useFragmentToken() {
    const { hash, pathname, search } = useLocation();
    const [token] = useState(() => readToken(hash));

    useEffect(() => {
        if (!hash && !window.location.hash) return;
        window.history.replaceState(
            window.history.state,
            "",
            `${pathname}${search}`
        );
    }, [hash, pathname, search]);

    return { token, hasToken: token !== null };
}
