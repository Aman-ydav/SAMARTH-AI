import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
    languageChanged,
    selectLanguage,
} from "@/features/preferences/slice/uiSlice";

/** Current UI language (`en | hi`) and a setter; persistence and i18n switching happen in app/listeners.js. */
export function useLanguage() {
    const dispatch = useAppDispatch();
    const language = useAppSelector(selectLanguage);
    return { language, setLanguage: (next) => dispatch(languageChanged(next)) };
}
