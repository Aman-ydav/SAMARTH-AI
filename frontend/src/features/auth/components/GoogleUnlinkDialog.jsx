import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/app/hooks";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FormFailureAlert } from "@/components/common/FormFailureAlert";
import { GoogleCredentialButton } from "@/features/auth/components/GoogleCredentialButton";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { unlinkGoogle } from "@/features/auth/slice/accountSlice";

/**
 * Unlink Google (AUTH-44, R38): the server asks for a fresh credential of the linked Google account and refuses with
 * `AUTH_METHOD_REQUIRED` when Google is the last way to log in. Errors show inside the dialog, so the person sees them
 * where they acted.
 */
export function GoogleUnlinkDialog({ open, onOpenChange, onUnlinked }) {
    const { t } = useTranslation(["auth", "common"]);
    const dispatch = useAppDispatch();
    const action = useAsyncAction();
    const { run, clearFailure } = action;

    function handleCredential(credential) {
        run(async () => {
            await dispatch(unlinkGoogle({ credential })).unwrap();
            onOpenChange(false);
            onUnlinked();
        });
    }

    return (
        <AlertDialog
            open={open}
            onOpenChange={(next) => {
                if (!next) clearFailure();
                onOpenChange(next);
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {t("settings.google.unlinkTitle")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {t("settings.google.unlinkBody")}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div aria-busy={action.pending}>
                    <GoogleCredentialButton onCredential={handleCredential} />
                </div>
                <FormFailureAlert
                    failure={action.failure}
                    cooldownSec={action.cooldownSec}
                />
                <AlertDialogFooter>
                    <AlertDialogCancel>{t("common:cancel")}</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
