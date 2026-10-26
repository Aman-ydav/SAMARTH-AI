import { useEffect } from "react";
import { useAppSelector } from "@/app/hooks";
import { selectTheme } from "@/features/preferences/slice/uiSlice";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemPrefersDark() {
    if (
        typeof window === "undefined" ||
        typeof window.matchMedia !== "function"
    )
        return false;
    return window.matchMedia(DARK_QUERY).matches;
}

/** Resolves `light | dark | system` to the concrete `light | dark` that should be shown. */
export function resolveTheme(theme) {
    if (theme === "dark") return "dark";
    if (theme === "light") return "light";
    return systemPrefersDark() ? "dark" : "light";
}

/** Toggles the `.dark` class on <html> (UI: class strategy, no flash when called before first render). */
export function applyTheme(theme) {
    if (typeof document === "undefined") return "light";
    const resolved = resolveTheme(theme);
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    return resolved;
}

/** Keeps <html> in step with the stored choice and, while on `system`, with OS changes. */
export function useThemeSync() {
    const theme = useAppSelector(selectTheme);

    useEffect(() => {
        applyTheme(theme);
        if (theme !== "system" || typeof window.matchMedia !== "function")
            return undefined;
        const query = window.matchMedia(DARK_QUERY);
        const onChange = () => applyTheme("system");
        query.addEventListener("change", onChange);
        return () => query.removeEventListener("change", onChange);
    }, [theme]);
}
