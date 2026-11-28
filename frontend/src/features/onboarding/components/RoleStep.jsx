import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { LoadErrorAlert } from "@/components/common/LoadErrorAlert";
import { Button } from "@/components/ui/button";
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormMessage } from "@/features/auth/hooks/useFormMessage";
import { roleStepSchema } from "@/features/onboarding/schemas/onboardingSchemas";
import { STATUS } from "@/lib/asyncState";

/** Step 1: designation, department, years of service and target role. Values live in Redux between steps. */
export function RoleStep({ profile, roles, onRetryRoles, onSubmit }) {
    const { t } = useTranslation("common");
    const message = useFormMessage();
    const form = useForm({
        resolver: zodResolver(roleStepSchema),
        defaultValues: profile,
        mode: "onTouched",
    });
    const { errors } = form.formState;

    const textField = (name, props = {}) => (
        <Field data-invalid={Boolean(errors[name])}>
            <FieldLabel htmlFor={`onboarding-${name}`}>
                {t(`onboarding.role.${name}`)}
            </FieldLabel>
            <Input
                id={`onboarding-${name}`}
                aria-invalid={errors[name] ? true : undefined}
                aria-describedby={
                    errors[name] ? `onboarding-${name}-error` : undefined
                }
                {...form.register(name)}
                {...props}
            />
            <FieldError id={`onboarding-${name}-error`}>
                {message(errors[name]?.message)}
            </FieldError>
        </Field>
    );

    return (
        <form
            noValidate
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-6"
        >
            <FieldGroup>
                {textField("designation", { autoComplete: "organization-title" })}
                {textField("department", { autoComplete: "organization" })}
                {textField("yearsOfService", {
                    inputMode: "numeric",
                    maxLength: 2,
                })}
                <Field data-invalid={Boolean(errors.targetRole)}>
                    <FieldLabel htmlFor="onboarding-targetRole">
                        {t("onboarding.role.targetRole")}
                    </FieldLabel>
                    {roles.status === STATUS.LOADING ||
                    roles.status === STATUS.IDLE ? (
                        <Skeleton className="h-9 w-full" />
                    ) : roles.status === STATUS.FAILED ? (
                        <LoadErrorAlert
                            error={roles.error}
                            onRetry={onRetryRoles}
                        />
                    ) : roles.items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {t("onboarding.role.noRoles")}
                        </p>
                    ) : (
                        <Controller
                            control={form.control}
                            name="targetRole"
                            render={({ field }) => (
                                <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                >
                                    <SelectTrigger
                                        id="onboarding-targetRole"
                                        className="w-full"
                                        aria-invalid={
                                            errors.targetRole ? true : undefined
                                        }
                                        onBlur={field.onBlur}
                                    >
                                        <SelectValue
                                            placeholder={t(
                                                "onboarding.role.targetRolePlaceholder"
                                            )}
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles.items.map((role) => (
                                            <SelectItem
                                                key={role.id}
                                                value={String(role.id)}
                                            >
                                                {role.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    )}
                    <FieldError>{message(errors.targetRole?.message)}</FieldError>
                </Field>
            </FieldGroup>
            <div className="flex justify-end">
                <Button type="submit">{t("next")}</Button>
            </div>
        </form>
    );
}
