import { useTranslation } from "react-i18next";
import {
    CheckCircleIcon,
    MoreHorizontalIcon,
    UserForbidIcon,
    UserSettingsIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { rolesChangeableTo, statusActionFor } from "@/lib/permissions";

/**
 * The row menu of the users table. It offers only what the API would accept for this actor and account: suspend or
 * reactivate (not yourself, not a platform admin, not an admin when you are an admin) and change role (platform admin
 * only, never yourself). With nothing to offer the menu is not rendered at all (hidden, never merely disabled, UI-61).
 */
export function UserActionsMenu({
    actor,
    user,
    name,
    disabled,
    onStatus,
    onChangeRole,
}) {
    const { t } = useTranslation("admin");
    const statusAction = statusActionFor(actor, user);
    const canChangeRole = rolesChangeableTo(actor, user).length > 0;
    if (!statusAction && !canChangeRole) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    aria-label={t("users.actions.open", { name })}
                >
                    <MoreHorizontalIcon aria-hidden="true" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {statusAction === "suspend" && (
                    <DropdownMenuItem
                        onSelect={() => onStatus(user, "suspend")}
                    >
                        <UserForbidIcon aria-hidden="true" />
                        {t("users.actions.suspend")}
                    </DropdownMenuItem>
                )}
                {statusAction === "reactivate" && (
                    <DropdownMenuItem
                        onSelect={() => onStatus(user, "reactivate")}
                    >
                        <CheckCircleIcon aria-hidden="true" />
                        {t("users.actions.reactivate")}
                    </DropdownMenuItem>
                )}
                {canChangeRole && (
                    <DropdownMenuItem onSelect={() => onChangeRole(user)}>
                        <UserSettingsIcon aria-hidden="true" />
                        {t("users.actions.changeRole")}
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
