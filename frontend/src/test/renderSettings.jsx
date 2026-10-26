import { useAppSelector } from "@/app/hooks";
import { selectCurrentUser } from "@/features/auth/slice/authSlice";
import { signedInAuth } from "@/test/authState";
import { renderPage } from "@/test/pageHarness";

/**
 * Renders a settings section that takes a `user` prop, the way the settings pages do: the user comes from the store, so
 * a slice update (password set, Google linked, photo changed) re-renders the section with the fresh summary.
 *
 * - `user`: overrides for the signed-in user summary (for example `{ hasPassword: false }`)
 * - everything else goes to `renderPage` (`path`, `history`, `store`, ...)
 */
export function renderWithUser(
    Section,
    { user = {}, path = "/settings/security", ...options } = {}
) {
    function Harness() {
        const current = useAppSelector(selectCurrentUser);
        return <Section user={current} />;
    }
    return renderPage(Harness, {
        path,
        preloadedState: { auth: signedInAuth(user) },
        ...options,
    });
}
