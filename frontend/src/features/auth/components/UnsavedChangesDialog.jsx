import { useRef } from "react";
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

/** Confirm dialog for a navigation that `useUnsavedChangesGuard` blocked; Radix returns focus to the page when it closes. */
export function UnsavedChangesDialog({ blocker }) {
    const { t } = useTranslation("auth");
    const leaving = useRef(false);
    return (
        <AlertDialog
            open={blocker.state === "blocked"}
            onOpenChange={(open) => {
                if (!open && !leaving.current && blocker.state === "blocked")
                    blocker.reset();
                leaving.current = false;
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {t("settings.profile.unsaved.title")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {t("settings.profile.unsaved.body")}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>
                        {t("settings.profile.unsaved.stay")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        variant="destructive"
                        onClick={() => {
                            leaving.current = true;
                            blocker.proceed?.();
                        }}
                    >
                        {t("settings.profile.unsaved.leave")}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
