import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import {
    LogoutIcon,
    ShieldIcon,
    UserIcon,
    ComputerIcon,
} from "@/components/icons";
import { RoleBadge } from "@/components/layout/RoleBadge";
import { UserAvatar } from "@/components/layout/UserAvatar";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSignOut } from "@/features/auth";
import { getDisplayName } from "@/lib/navigation";
import { PATHS } from "@/lib/paths";

/**
 * Avatar button with the account menu (UI-60, UI-61): who is signed in, profile, security, sessions, log out and
 * log out of all devices (behind a confirm dialog). Logging out is honest: failures keep the user signed in.
 */
export function UserMenu({ user }) {
    const { t } = useTranslation("nav");
    const { pending, signOut, signOutEverywhere } = useSignOut();
    const [confirmAll, setConfirmAll] = useState(false);

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full"
                        aria-label={t("account.menu")}
                    >
                        <UserAvatar user={user} />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel className="flex flex-col items-start gap-0.5 font-normal">
                        <span className="w-full text-sm font-medium wrap-break-word text-foreground">
                            {getDisplayName(user)}
                        </span>
                        <span className="w-full text-xs wrap-break-word text-muted-foreground">
                            {user?.email}
                        </span>
                        <RoleBadge role={user?.role} className="mt-1" />
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                        <Link to={PATHS.settingsProfile}>
                            <UserIcon aria-hidden="true" />
                            {t("account.profile")}
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link to={PATHS.settingsSecurity}>
                            <ShieldIcon aria-hidden="true" />
                            {t("account.security")}
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link to={PATHS.settingsSessions}>
                            <ComputerIcon aria-hidden="true" />
                            {t("account.sessions")}
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        disabled={Boolean(pending)}
                        onSelect={signOut}
                    >
                        <LogoutIcon aria-hidden="true" />
                        {pending === "one"
                            ? t("account.loggingOut")
                            : t("logout")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        disabled={Boolean(pending)}
                        onSelect={() => setConfirmAll(true)}
                    >
                        <LogoutIcon aria-hidden="true" />
                        {t("account.logoutAll")}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
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
