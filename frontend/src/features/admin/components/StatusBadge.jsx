import { useTranslation } from "react-i18next";
import {
    CheckCircleIcon,
    CloseIcon,
    ForbidIcon,
    HelpIcon,
    HourglassIcon,
    MailSendIcon,
    PauseIcon,
    TrashIcon,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";

/* Status is always text plus an icon, never colour alone (UI-07). Unknown values get the neutral badge (FE-37). Label keys are
   written out (FE-83) so the key checker sees them. */
const INVITE = {
    sent: {
        variant: "info",
        Icon: MailSendIcon,
        label: "invites.status.sent",
    },
    accepted: {
        variant: "success",
        Icon: CheckCircleIcon,
        label: "invites.status.accepted",
    },
    revoked: {
        variant: "outline",
        Icon: ForbidIcon,
        label: "invites.status.revoked",
    },
    expired: {
        variant: "warning",
        Icon: HourglassIcon,
        label: "invites.status.expired",
    },
};
const USER = {
    invited: {
        variant: "info",
        Icon: MailSendIcon,
        label: "users.status.invited",
    },
    pending_verification: {
        variant: "warning",
        Icon: HourglassIcon,
        label: "users.status.pending_verification",
    },
    active: {
        variant: "success",
        Icon: CheckCircleIcon,
        label: "users.status.active",
    },
    suspended: {
        variant: "destructive",
        Icon: ForbidIcon,
        label: "users.status.suspended",
    },
    deactivated: {
        variant: "outline",
        Icon: PauseIcon,
        label: "users.status.deactivated",
    },
    pending_deletion: {
        variant: "warning",
        Icon: TrashIcon,
        label: "users.status.pending_deletion",
    },
    deleted: {
        variant: "outline",
        Icon: CloseIcon,
        label: "users.status.deleted",
    },
};
const UNKNOWN = { variant: "outline", Icon: HelpIcon };

/** Badge for an invitation status (`kind="invite"`) or an account status (`kind="user"`). */
export function StatusBadge({ kind, status }) {
    const { t } = useTranslation("admin");
    const table = kind === "invite" ? INVITE : USER;
    const entry = Object.hasOwn(table, status) ? table[status] : UNKNOWN;
    const label =
        entry.label ??
        (kind === "invite" ? "invites.status.unknown" : "users.status.unknown");
    return (
        <Badge variant={entry.variant}>
            <entry.Icon aria-hidden="true" />
            {t(label)}
        </Badge>
    );
}
