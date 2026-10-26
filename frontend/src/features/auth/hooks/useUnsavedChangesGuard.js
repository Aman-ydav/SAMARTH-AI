import { useEffect } from "react";
import { useBlocker } from "react-router";

/**
 * Warns before unsaved edits are lost (EDGE-107, FE-73): in-app navigation is blocked until the person decides (the
 * returned `blocker` drives a confirm dialog) and closing or reloading the tab shows the browser prompt.
 * Needs a data router, as every app route has.
 */
export function useUnsavedChangesGuard(dirty) {
    const blocker = useBlocker(dirty);

    useEffect(() => {
        if (!dirty) return undefined;
        const warn = (event) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    return blocker;
}
