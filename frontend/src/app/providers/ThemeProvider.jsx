import { useThemeSync } from "@/features/preferences";

/** Applies the stored theme to <html> and follows OS changes while on `system`. */
export function ThemeProvider({ children }) {
    useThemeSync();
    return children;
}
