import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useSignOut } from "@/features/auth/hooks/useSignOut";

/**
 * "Log out of all devices" behind a confirm dialog (FE-59): the request is honest, so a failure keeps the person signed in
 * and says so. It reuses the account-menu wording from the `nav` namespace.
 */
export function LogoutAllButton({ variant = "outline", className }) {
    const { t } = useTranslation(["nav", "common"]);
    const { pending, signOutEverywhere } = useSignOut();
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button
                type="button"
                variant={variant}
                className={className}
                disabled={Boolean(pending)}
                aria-busy={pending === "all"}
                onClick={() => setOpen(true)}
            >
                {pending === "all" && <Spinner />}
                {t("account.logoutAll")}
            </Button>
            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("account.confirmLogoutAllTitle")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("account.confirmLogoutAllBody")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            {t("common:cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={signOutEverywhere}>
                            {t("account.confirmLogoutAllAction")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
