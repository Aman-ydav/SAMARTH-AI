import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { FormFailureAlert } from "@/components/common/FormFailureAlert";

/**
 * Confirm screen for a one-time email link (R2, AUTH-32). Opening the link only renders this panel; nothing is
 * consumed until the person presses the button, because mail scanners prefetch links. A failed attempt shows the
 * generic error above the button, which stays mounted so the person can retry.
 */
export function TokenConfirmPanel({
    icon,
    title,
    body,
    confirmLabel,
    onConfirm,
    pending = false,
    failure = null,
    cooldownSec = 0,
    children,
}) {
    return (
        <AuthCard icon={icon} title={title} description={body}>
            <div className="flex flex-col gap-4">
                {children}
                <FormFailureAlert failure={failure} cooldownSec={cooldownSec} />
                <Button
                    type="button"
                    className="w-full"
                    onClick={onConfirm}
                    disabled={pending || cooldownSec > 0}
                    aria-busy={pending}
                >
                    {pending && <Spinner />}
                    {confirmLabel}
                </Button>
            </div>
        </AuthCard>
    );
}
