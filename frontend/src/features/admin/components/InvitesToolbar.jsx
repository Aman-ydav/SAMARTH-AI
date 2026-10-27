import { useTranslation } from "react-i18next";
import { RefreshIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const ALL = "all";
/* Label keys are written out (FE-83) so the key checker sees them. */
const STATUS_OPTIONS = [
    ["sent", "invites.status.sent"],
    ["accepted", "invites.status.accepted"],
    ["revoked", "invites.status.revoked"],
    ["expired", "invites.status.expired"],
];

/** Status filter and refresh button above the invitation list. The filter value is the URL's `status` (FE-26). */
export function InvitesToolbar({ status, loading, onStatusChange, onRefresh }) {
    const { t } = useTranslation("admin");
    return (
        <div className="flex items-end gap-3">
            <Field className="w-48">
                <FieldLabel htmlFor="invites-status-filter">
                    {t("invites.list.filterLabel")}
                </FieldLabel>
                <Select
                    value={status ?? ALL}
                    onValueChange={(value) =>
                        onStatusChange(value === ALL ? undefined : value)
                    }
                >
                    <SelectTrigger
                        id="invites-status-filter"
                        className="w-full"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>
                            {t("invites.list.allStatuses")}
                        </SelectItem>
                        {STATUS_OPTIONS.map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                                {t(label)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </Field>
            <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={onRefresh}
            >
                <RefreshIcon aria-hidden="true" />
                {t("refresh")}
            </Button>
        </div>
    );
}
