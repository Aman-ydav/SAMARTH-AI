import { memo, useId } from "react";
import { Controller } from "react-hook-form";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from "@/components/ui/field";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { authFieldId } from "@/features/auth/hooks/useAuthFormSubmit";
import { useFormMessage } from "@/features/auth/hooks/useFormMessage";

/**
 * Labelled shadcn Select wired to react-hook-form (FE-74, FE-79): the label targets the trigger, the error and the optional
 * description are linked with `aria-describedby`. `options` is a list of `{ value, label }`.
 */
/* Memoised with a measured reason: the time zone list has about 400 items and the surrounding form re-renders on every keystroke. */
export const SettingsSelectField = memo(function SettingsSelectField({
    form,
    name,
    label,
    description,
    options,
    lang,
}) {
    const message = useFormMessage();
    const descriptionId = useId();
    const errorId = `${authFieldId(name)}-error`;

    return (
        <Controller
            control={form.control}
            name={name}
            render={({ field, fieldState }) => (
                <Field data-invalid={Boolean(fieldState.error)}>
                    <FieldLabel htmlFor={authFieldId(name)}>{label}</FieldLabel>
                    <Select
                        name={name}
                        value={field.value}
                        onValueChange={field.onChange}
                    >
                        <SelectTrigger
                            id={authFieldId(name)}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            className="w-full"
                            aria-invalid={fieldState.error ? true : undefined}
                            aria-describedby={
                                [
                                    fieldState.error ? errorId : null,
                                    description ? descriptionId : null,
                                ]
                                    .filter(Boolean)
                                    .join(" ") || undefined
                            }
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {options.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                    lang={lang ? option.value : undefined}
                                >
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {description && (
                        <FieldDescription id={descriptionId}>
                            {description}
                        </FieldDescription>
                    )}
                    <FieldError id={errorId}>
                        {message(fieldState.error?.message)}
                    </FieldError>
                </Field>
            )}
        />
    );
});
