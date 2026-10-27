import { useTranslation } from "react-i18next";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Generic confirm step for a destructive action (rule 09 defaults): Radix traps focus, starts on Cancel and returns focus
 * to the control that opened it. `onConfirm` runs after the dialog closes. `destructive` (default) styles the action as a
 * destructive one; pass `false` for a neutral confirmation such as reactivating an account.
 */
export function ConfirmActionDialog({
    open,
    onOpenChange,
    title,
    description,
    actionLabel,
    onConfirm,
    destructive = true,
}) {
    const { t } = useTranslation("common");
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                        variant={destructive ? "destructive" : "default"}
                        onClick={onConfirm}
                    >
                        {actionLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
