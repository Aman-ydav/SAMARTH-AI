import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertDialog, AlertDialogContent } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DeleteAccountForm } from "@/features/auth/components/DeleteAccountForm";
import { SectionCard } from "@/features/auth/components/SectionCard";

/** Danger zone: opens the delete-account dialog. The form lives inside the dialog content, so it resets whenever it closes. */
export function DeleteAccountSection({ user }) {
    const { t } = useTranslation("auth");
    const [open, setOpen] = useState(false);

    return (
        <SectionCard
            tone="destructive"
            title={t("settings.delete.heading")}
            description={t("settings.delete.description")}
        >
            <Button
                type="button"
                variant="destructive"
                className="w-fit"
                onClick={() => setOpen(true)}
            >
                {t("settings.delete.open")}
            </Button>
            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogContent>
                    <DeleteAccountForm user={user} />
                </AlertDialogContent>
            </AlertDialog>
        </SectionCard>
    );
}
