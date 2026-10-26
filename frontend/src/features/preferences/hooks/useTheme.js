import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { resolveTheme } from "@/features/preferences/hooks/useThemeSync";
import {
    selectTheme,
    themeChanged,
} from "@/features/preferences/slice/uiSlice";

/** Current theme choice (`light | dark | system`), the concrete theme in effect, and a setter. */
export function useTheme() {
    const dispatch = useAppDispatch();
    const theme = useAppSelector(selectTheme);
    return {
        theme,
        resolvedTheme: resolveTheme(theme),
        setTheme: (next) => dispatch(themeChanged(next)),
    };
}
