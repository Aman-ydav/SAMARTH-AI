import { useLocation } from "react-router";
import { readReturnTo } from "@/lib/safeRedirect";

/** The validated post-login destination carried by the current location (router state, then `?returnTo=`). */
export function useReturnTo(fallback) {
    return readReturnTo(useLocation(), fallback);
}
