import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/app/hooks";
import { FormFailureAlert } from "@/components/common/FormFailureAlert";
import { SubmitButton } from "@/components/common/SubmitButton";
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
import { Field, FieldLabel } from "@/components/ui/field";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import * as adminApi from "@/features/admin/api/adminApi";
import { useAdminErrorText } from "@/features/admin/hooks/useAdminErrorText";
import { updateUserOrganisation } from "@/features/admin/slice/adminUsersSlice";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { notify } from "@/hooks/useNotify";

const STALE_STATUSES = new Set([404, 409]);

export function OrganisationChangeDialog({ target, onClose, onRefresh }) {
    const { t } = useTranslation(["admin", "common"]);
    const dispatch = useAppDispatch();
    const action = useAsyncAction();
    const errorText = useAdminErrorText("users");
    const [organisationState, setOrganisationState] = useState({
        targetId: null,
        items: [],
        error: false,
    });
    const [selection, setSelection] = useState({
        targetId: null,
        organisationId: "",
    });
    const name = target ? target.name || target.email : "";
    const organisations =
        organisationState.targetId === target?.id
            ? organisationState.items
            : [];
    const loadError =
        organisationState.targetId === target?.id &&
        organisationState.error;
    const organisationId =
        selection.targetId === target?.id
            ? selection.organisationId
            : (target?.orgId ?? "");

    useEffect(() => {
        if (!target) return undefined;
        const controller = new AbortController();
        adminApi
            .listOrganisations({ status: "active", limit: 100 }, {
                signal: controller.signal,
            })
            .then(({ items }) =>
                setOrganisationState({
                    targetId: target.id,
                    items,
                    error: false,
                })
            )
            .catch(() => {
                if (!controller.signal.aborted) {
                    setOrganisationState({
                        targetId: target.id,
                        items: [],
                        error: true,
                    });
                }
            });
        return () => controller.abort();
    }, [target]);

    const close = () => {
        if (action.pending) return;
        action.clearFailure();
        setSelection({ targetId: null, organisationId: "" });
        onClose();
    };

    async function submit(event) {
        event.preventDefault();
        if (!target || !organisationId || organisationId === target.orgId)
            return;
        await action.run(
            async () => {
                const updated = await dispatch(
                    updateUserOrganisation({
                        id: target.id,
                        organisationId,
                    })
                ).unwrap();
                await notify(
                    "success",
                    t("admin:users.organisationDialog.done", {
                        name,
                        organisation:
                            organisations.find((item) => item.id === updated.orgId)
                                ?.name ?? updated.orgId,
                    }),
                    `organisation-changed-${target.id}`
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
                if (!open) close();
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {t("admin:users.organisationDialog.title", { name })}
                    </DialogTitle>
                    <DialogDescription>
                        {t("admin:users.organisationDialog.description")}
                    </DialogDescription>
                </DialogHeader>
                <form
                    noValidate
                    onSubmit={submit}
                    aria-busy={action.pending}
                    className="flex flex-col gap-4"
                >
                    {loadError ? (
                        <Alert variant="destructive" role="alert">
                            <AlertDescription>
                                {t("admin:organisations.loadError")}
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <Field>
                            <FieldLabel htmlFor="user-organisation">
                                {t("admin:users.organisationDialog.label")}
                            </FieldLabel>
                            <Select
                                value={organisationId}
                                onValueChange={(value) =>
                                    setSelection({
                                        targetId: target.id,
                                        organisationId: value,
                                    })
                                }
                                disabled={action.pending}
                            >
                                <SelectTrigger
                                    id="user-organisation"
                                    className="w-full"
                                >
                                    <SelectValue
                                        placeholder={t(
                                            "admin:users.organisationDialog.placeholder"
                                        )}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {organisations.map((organisation) => (
                                        <SelectItem
                                            key={organisation.id}
                                            value={organisation.id}
                                        >
                                            {organisation.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                    )}
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
                            disabled={
                                loadError ||
                                !organisationId ||
                                organisationId === target?.orgId ||
                                action.cooldownSec > 0
                            }
                            className="w-auto"
                        >
                            {t("admin:users.organisationDialog.submit")}
                        </SubmitButton>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
