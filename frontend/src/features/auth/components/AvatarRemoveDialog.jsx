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

/** Confirm before the saved photo is removed (EDGE default: destructive actions confirm). */
export function AvatarRemoveDialog({ open, onOpenChange, onConfirm }) {
    const { t } = useTranslation(["auth", "common"]);
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {t("settings.avatar.removeConfirm.title")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {t("settings.avatar.removeConfirm.body")}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{t("common:cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                        variant="destructive"
                        onClick={onConfirm}
                    >
                        {t("settings.avatar.removeConfirm.action")}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
