import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";

const ROLE_LABEL_KEYS = {
    learner: "role.learner",
    trainer: "role.trainer",
    admin: "role.admin",
    superadmin: "role.superadmin",
};

/** Role name as a badge. Text, not colour, carries the meaning (UI-07); unknown roles fall back to the learner label. */
export function RoleBadge({ role, className }) {
    const { t } = useTranslation("common");
    return (
        <Badge variant="secondary" className={className}>
            {t(ROLE_LABEL_KEYS[role] ?? ROLE_LABEL_KEYS.learner)}
        </Badge>
    );
}
