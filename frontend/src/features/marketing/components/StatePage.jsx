import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { usePageHeadingFocus } from "@/features/marketing/hooks/usePageHeadingFocus";

/**
 * One action button. `to` renders a router link, otherwise `onClick` renders a button.
 * @typedef {{ label: string, to?: string, onClick?: () => void, disabled?: boolean }} StateAction
 */
function StateActionButton({ action, variant }) {
    if (action.to) {
        return (
            <Button asChild variant={variant}>
                <Link to={action.to}>{action.label}</Link>
            </Button>
        );
    }
    return (
        <Button
            type="button"
            variant={variant}
            onClick={action.onClick}
            disabled={action.disabled}
        >
            {action.label}
        </Button>
    );
}

/**
 * Shared shell for the start, error and state pages (docs/23 section 6): centred card, filled icon, one h1 that
 * receives focus on mount, one explanation, a primary and an optional secondary action. The page title is also
 * written to the document title (the root layout sets the same value from the route handle).
 * Children render between the explanation and the actions (request id, live status, steps).
 *
 * @param {{ icon: import("react").ElementType, title: string, body?: string, primary?: StateAction,
 *   secondary?: StateAction, children?: import("react").ReactNode }} props
 */
export function StatePage({
    icon: Icon,
    title,
    body,
    primary,
    secondary,
    children,
}) {
    const { t } = useTranslation("common");
    const headingRef = usePageHeadingFocus();
    useDocumentTitle(t("documentTitle", { page: title }));

    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-12 sm:px-6 md:py-20"
        >
            <Card>
                <CardContent className="items-center gap-4 text-center">
                    <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                        <Icon aria-hidden="true" className="size-6" />
                    </span>
                    <h1
                        ref={headingRef}
                        tabIndex={-1}
                        className="type-h1 text-balance"
                    >
                        {title}
                    </h1>
                    {body ? (
                        <p className="type-body max-w-prose text-muted-foreground">
                            {body}
                        </p>
                    ) : null}
                    {children}
                    {primary || secondary ? (
                        <div className="flex flex-wrap justify-center gap-3 pt-2">
                            {primary ? (
                                <StateActionButton action={primary} />
                            ) : null}
                            {secondary ? (
                                <StateActionButton
                                    action={secondary}
                                    variant="outline"
                                />
                            ) : null}
                        </div>
                    ) : null}
                </CardContent>
            </Card>
        </main>
    );
}
