import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/app/hooks";
import { FormFailureAlert } from "@/components/common/FormFailureAlert";
import { SubmitButton } from "@/components/common/SubmitButton";
import { WarningIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAdminErrorText } from "@/features/admin/hooks/useAdminErrorText";
import { changeRoleSchema } from "@/features/admin/schemas/adminSchemas";
import { updateUserRole } from "@/features/admin/slice/adminUsersSlice";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { notify } from "@/hooks/useNotify";
import { ASSIGNABLE_ROLES } from "@/lib/permissions";
import { roleLabelKey } from "@/lib/roleLabels";

const STALE_STATUSES = new Set([404, 409]);

/**
 * Role change for one account (platform admin only, AUTH-61). It lists the three assignable roles with the current one
 * disabled and says that the person is signed out on every device. Failures (403, 404, 409 including the last admin)
 * stay inside the dialog with their own text; a stale account also reloads the list. Mount it with a `target` to open it.
 */
export function RoleChangeDialog({ target, onClose, onRefresh }) {
    const { t } = useTranslation(["admin", "common"]);
    const dispatch = useAppDispatch();
    const action = useAsyncAction();
    const errorText = useAdminErrorText("users");
    const [role, setRole] = useState("");
    const [invalid, setInvalid] = useState(false);

    const name = target ? target.name || target.email : "";
    const close = () => {
        setRole("");
        setInvalid(false);
        action.clearFailure();
        onClose();
    };

    async function submit(event) {
        event.preventDefault();
        const parsed = changeRoleSchema.safeParse({ role });
        setInvalid(!parsed.success);
        if (!parsed.success) return;
        await action.run(
            async () => {
                const updated = await dispatch(
                    updateUserRole({ id: target.id, role: parsed.data.role })
                ).unwrap();
                await notify(
                    "success",
                    t("admin:users.roleDialog.done", {
                        name,
                        role: t(roleLabelKey(updated.role)),
                    }),
                    `admin-done-${target.id}`
                );
                onRefresh();
                close();
            },
            (error) => {
                if (STALE_STATUSES.has(error.statusCode)) onRefresh();
                return false;
            }
        );
    }

    return (
        <Dialog
            open={target !== null}
            onOpenChange={(open) => {
                if (!open && !action.pending) close();
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {t("admin:users.roleDialog.title", { name })}
                    </DialogTitle>
                    <DialogDescription>
                        {t("admin:users.roleDialog.description", {
                            name,
                            role: t(roleLabelKey(target?.role)),
                        })}
                    </DialogDescription>
                </DialogHeader>
                <form
                    noValidate
                    onSubmit={submit}
                    aria-busy={action.pending}
                    className="flex flex-col gap-4"
                >
                    <FieldSet disabled={action.pending}>
                        <FieldLegend variant="label">
                            {t("admin:users.roleDialog.legend")}
                        </FieldLegend>
                        <RadioGroup
                            value={role}
                            onValueChange={(value) => {
                                setRole(value);
                                setInvalid(false);
                            }}
                            aria-invalid={invalid ? true : undefined}
                        >
                            {ASSIGNABLE_ROLES.map((option) => (
                                <div
                                    key={option}
                                    className="flex items-center gap-3"
                                >
                                    <RadioGroupItem
                                        id={`role-option-${option}`}
                                        value={option}
                                        disabled={option === target?.role}
                                    />
                                    <Label htmlFor={`role-option-${option}`}>
                                        {t(roleLabelKey(option))}
                                        {option === target?.role && (
                                            <span className="ms-2 text-muted-foreground">
                                                (
                                                {t(
                                                    "admin:users.roleDialog.current"
                                                )}
                                                )
                                            </span>
                                        )}
                                    </Label>
                                </div>
                            ))}
                        </RadioGroup>
                        {invalid && (
                            <p className="text-sm text-destructive">
                                {t("admin:users.roleDialog.roleRequired")}
                            </p>
                        )}
                    </FieldSet>
                    <Alert variant="warning" role="note">
                        <WarningIcon aria-hidden="true" />
                        <AlertDescription>
                            {t("admin:users.roleDialog.warning", { name })}
                        </AlertDescription>
                    </Alert>
                    <FormFailureAlert
                        failure={action.failure}
                        cooldownSec={action.cooldownSec}
                        message={
                            action.failure
                                ? errorText(action.failure)
                                : undefined
                        }
                    />
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={action.pending}
                            onClick={close}
                        >
                            {t("common:cancel")}
                        </Button>
                        <SubmitButton
                            pending={action.pending}
                            disabled={role === "" || action.cooldownSec > 0}
                            className="w-auto"
                        >
                            {t("admin:users.roleDialog.submit")}
                        </SubmitButton>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
