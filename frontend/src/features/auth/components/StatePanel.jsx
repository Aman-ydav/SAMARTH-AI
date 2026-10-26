import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/features/auth/components/AuthCard";

function PanelAction({ action, variant }) {
    if (!action) return null;
    const { label, to, state, onClick, disabled } = action;
    if (to)
        return (
            <Button asChild variant={variant}>
                <Link to={to} state={state}>
                    {label}
                </Link>
            </Button>
        );
    return (
        <Button
            type="button"
            variant={variant}
            onClick={onClick}
            disabled={disabled}
        >
            {label}
        </Button>
    );
}

/**
 * A state screen (session ended, link invalid, account locked ...): icon, title, one paragraph, optional extra
 * content, a primary and a secondary action. Actions are `{ label, to, state }` links or `{ label, onClick }`.
 */
export function StatePanel({
    icon,
    tone,
    title,
    body,
    primary,
    secondary,
    focusTitle = false,
    children,
}) {
    return (
        <AuthCard
            icon={icon}
            tone={tone}
            title={title}
            description={body}
            focusTitle={focusTitle}
        >
            {children}
            {(primary || secondary) && (
                <div className="flex flex-col gap-3 sm:flex-row">
                    <PanelAction action={primary} variant="default" />
                    <PanelAction action={secondary} variant="outline" />
                </div>
            )}
        </AuthCard>
    );
}
