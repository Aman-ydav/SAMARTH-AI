import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * Submit button for auth forms (UI-50, FE-77): the label stays, a spinner joins it while pending, and the
 * button is disabled with `aria-busy` but never unmounted.
 */
export function SubmitButton({
    pending = false,
    disabled = false,
    children,
    ...props
}) {
    return (
        <Button
            type="submit"
            className="w-full"
            disabled={pending || disabled}
            aria-busy={pending}
            {...props}
        >
            {pending && <Spinner />}
            {children}
        </Button>
    );
}
