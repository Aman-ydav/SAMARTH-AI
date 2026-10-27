import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/app/hooks";
import { FormFailureAlert } from "@/components/common/FormFailureAlert";
import { SubmitButton } from "@/components/common/SubmitButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon } from "@/components/icons";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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
import { inviteSchemaFor } from "@/features/admin/schemas/adminSchemas";
import { createInvite } from "@/features/admin/slice/invitesSlice";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { notify } from "@/hooks/useNotify";
import { API_ERROR_CODES, errorMessageKey } from "@/lib/apiError";
import { applyServerErrors } from "@/lib/forms";
import { roleLabelKey } from "@/lib/roleLabels";

const FIELDS = ["email", "role"];

/**
 * Invite one person by email (R68, doc 20 section 1a). The role list is what the signed-in role may grant: an admin sees
 * Trainer, a platform admin sees Trainer and Admin. The server stays the authority. A 409 says the same thing whether the
 * address has an account or an open invitation, so the form never reveals which (EDGE-70, EDGE-115). `onInvited` runs after
 * a successful send so the list can read again.
 */
export function InviteForm({ role: actorRole, roles, onInvited }) {
    const { t } = useTranslation(["admin", "validation", "errors", "common"]);
    const dispatch = useAppDispatch();
    const action = useAsyncAction();
    const form = useForm({
        resolver: zodResolver(inviteSchemaFor(actorRole)),
        defaultValues: { email: "", role: roles.length === 1 ? roles[0] : "" },
    });
    const { errors } = form.formState;
    const text = (message) =>
        typeof message === "string" && message
            ? t(message, { defaultValue: message })
            : "";

    const onSubmit = form.handleSubmit((values) =>
        action.run(
            async () => {
                const invite = await dispatch(
                    createInvite({ email: values.email, role: values.role })
                ).unwrap();
                form.reset({ email: "", role: values.role });
                await notify(
                    "success",
                    t("admin:invites.form.sent", { email: invite.email }),
                    "invite-sent"
                );
                onInvited();
            },
            (error) => {
                if (error.code === API_ERROR_CODES.CONFLICT) {
                    form.setError("email", {
                        type: "server",
                        message: "admin:invites.form.conflict",
                    });
                    form.setFocus("email");
                    return true;
                }
                if (error.code === "DOMAIN_NOT_ALLOWED") {
                    form.setError("email", {
                        type: "server",
                        message: errorMessageKey(error.code),
                    });
                    form.setFocus("email");
                    return true;
                }
                if (error.code !== API_ERROR_CODES.VALIDATION_ERROR)
                    return false;
                return (
                    applyServerErrors(error, {
                        setError: form.setError,
                        setFocus: form.setFocus,
                        fields: FIELDS,
                    }).fieldCount > 0
                );
            }
        )
    );

    if (roles.length === 0)
        return (
            <Alert variant="info" role="note">
                <InfoIcon aria-hidden="true" />
                <AlertDescription>
                    {t("admin:invites.form.noRoles")}
                </AlertDescription>
            </Alert>
        );

    return (
        <Card>
            <CardHeader>
                <CardTitle className="type-h3">
                    {t("admin:invites.form.title")}
                </CardTitle>
                <CardDescription>
                    {t("admin:invites.form.description")}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form
                    noValidate
                    onSubmit={onSubmit}
                    aria-busy={action.pending}
                    className="flex flex-col gap-6"
                >
                    <fieldset
                        disabled={action.pending}
                        className="flex flex-col gap-6"
                    >
                        <FieldGroup className="gap-4 md:flex-row md:items-start">
                            <Field data-invalid={Boolean(errors.email)}>
                                <FieldLabel htmlFor="invite-email">
                                    {t("admin:invites.form.email")}
                                </FieldLabel>
                                <Input
                                    id="invite-email"
                                    type="email"
                                    inputMode="email"
                                    spellCheck={false}
                                    placeholder={t(
                                        "admin:invites.form.emailPlaceholder"
                                    )}
                                    aria-invalid={
                                        errors.email ? true : undefined
                                    }
                                    aria-describedby={
                                        errors.email
                                            ? "invite-email-error"
                                            : undefined
                                    }
                                    {...form.register("email")}
                                />
                                <FieldError id="invite-email-error">
                                    {text(errors.email?.message)}
                                </FieldError>
                            </Field>
                            <Field data-invalid={Boolean(errors.role)}>
                                <FieldLabel htmlFor="invite-role">
                                    {t("admin:invites.form.role")}
                                </FieldLabel>
                                <Controller
                                    control={form.control}
                                    name="role"
                                    render={({ field }) => (
                                        <Select
                                            name="role"
                                            value={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            <SelectTrigger
                                                id="invite-role"
                                                ref={field.ref}
                                                onBlur={field.onBlur}
                                                className="w-full"
                                                aria-invalid={
                                                    errors.role
                                                        ? true
                                                        : undefined
                                                }
                                                aria-describedby={
                                                    errors.role
                                                        ? "invite-role-error"
                                                        : undefined
                                                }
                                            >
                                                <SelectValue
                                                    placeholder={t(
                                                        "admin:invites.form.rolePlaceholder"
                                                    )}
                                                />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {roles.map((role) => (
                                                    <SelectItem
                                                        key={role}
                                                        value={role}
                                                    >
                                                        {t(roleLabelKey(role))}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                <FieldError id="invite-role-error">
                                    {text(errors.role?.message)}
                                </FieldError>
                            </Field>
                        </FieldGroup>
                    </fieldset>
                    <FormFailureAlert
                        failure={action.failure}
                        cooldownSec={action.cooldownSec}
                    />
                    <SubmitButton
                        pending={action.pending}
                        disabled={action.cooldownSec > 0}
                        className="w-full sm:w-auto sm:self-start"
                    >
                        {t("admin:invites.form.submit")}
                    </SubmitButton>
                </form>
            </CardContent>
        </Card>
    );
}
