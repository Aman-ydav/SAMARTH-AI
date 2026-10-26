import { useId } from "react";
import { PasswordInput } from "@/components/common/PasswordInput";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authFieldId } from "@/features/auth/hooks/useAuthFormSubmit";
import { useFormMessage } from "@/features/auth/hooks/useFormMessage";

/**
 * One labelled form field wired to react-hook-form (FE-74, FE-79): label bound to the input, the error and the
 * optional description linked with `aria-describedby`, `aria-invalid` on error. `password` swaps in the shared
 * `PasswordInput` (show/hide, no `maxLength`: the 72-byte limit is a schema check, FE-78).
 */
export function AuthField({
    form,
    name,
    label,
    password = false,
    description,
    labelAside,
    children,
    ...inputProps
}) {
    const message = useFormMessage();
    const descriptionId = useId();
    const error = form.formState.errors[name];
    const errorId = `${authFieldId(name)}-error`;
    const Control = password ? PasswordInput : Input;
    const describedBy =
        [error ? errorId : null, description ? descriptionId : null]
            .filter(Boolean)
            .join(" ") || undefined;

    return (
        <Field data-invalid={Boolean(error)}>
            <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor={authFieldId(name)}>{label}</FieldLabel>
                {labelAside}
            </div>
            <Control
                id={authFieldId(name)}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy}
                {...form.register(name)}
                {...inputProps}
            />
            {description && (
                <FieldDescription id={descriptionId}>
                    {description}
                </FieldDescription>
            )}
            {children}
            <FieldError id={errorId}>{message(error?.message)}</FieldError>
        </Field>
    );
}
