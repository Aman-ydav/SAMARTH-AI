import { useEffect } from "react";

/** Sets `document.title` while the component is mounted (FE-70). */
export function useDocumentTitle(title) {
    useEffect(() => {
        if (typeof title === "string" && title) document.title = title;
    }, [title]);
}
