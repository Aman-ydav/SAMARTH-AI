import { Controller } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Field,
    FieldContent,
    FieldError,
    FieldLabel,
} from "@/components/ui/field";
import { authFieldId } from "@/features/auth/hooks/useAuthFormSubmit";
import { useFormMessage } from "@/features/auth/hooks/useFormMessage";

/** A checkbox field (consent, remember me) wired to react-hook-form; the label may contain links. */
export function AuthCheckboxField({ form, name, label }) {
    const message = useFormMessage();
    const id = authFieldId(name);
    const errorId = `${id}-error`;

    return (
        <Controller
            control={form.control}
            name={name}
            render={({ field, fieldState }) => (
                <Field
                    orientation="horizontal"
                    data-invalid={Boolean(fieldState.error)}
                >
                    <Checkbox
                        id={id}
                        name={field.name}
                        ref={field.ref}
                        checked={field.value === true}
                        onCheckedChange={(checked) =>
                            field.onChange(checked === true)
                        }
                        onBlur={field.onBlur}
                        aria-invalid={fieldState.error ? true : undefined}
                        aria-describedby={
                            fieldState.error ? errorId : undefined
                        }
                    />
                    <FieldContent>
                        <FieldLabel
                            htmlFor={id}
                            className="font-normal leading-normal"
                        >
                            {label}
                        </FieldLabel>
                        <FieldError id={errorId}>
                            {message(fieldState.error?.message)}
                        </FieldError>
                    </FieldContent>
                </Field>
            )}
        />
    );
}
