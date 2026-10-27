import { Button } from "@/components/ui/button";

/** Empty list: a muted icon, a title, one sentence and at most one action (UI-50, FE-93). */
export function ListEmptyState({ icon: Icon, title, body, action }) {
    return (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-6 text-center">
            <Icon aria-hidden="true" className="size-6 text-muted-foreground" />
            <p className="font-medium text-card-foreground">{title}</p>
            <p className="max-w-prose text-muted-foreground">{body}</p>
            {action && (
                <Button
                    type="button"
                    variant="outline"
                    onClick={action.onClick}
                >
                    {action.label}
                </Button>
            )}
        </div>
    );
}
