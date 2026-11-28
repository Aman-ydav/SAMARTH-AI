import { useTranslation } from "react-i18next";
import { RefreshIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AUDIT_ACTIONS,
    isoToLocalInput,
    localInputToIso,
} from "@/features/admin/schemas/auditSchemas";

const ALL = "all";

/**
 * Action and time-range filters of the audit list, with Clear and Refresh. The values live in the URL (FE-26), so a filtered
 * view can be bookmarked or shared. The time inputs show local time and send ISO instants; "from" cannot pass "to" (the
 * inputs bound each other, and the parser drops a reversed range). Action names are shown as the identifiers they are.
 */
export function AuditFilters({ query, setQuery, loading, onRefresh }) {
    const { t } = useTranslation("admin");
    const active = Boolean(query.action || query.from || query.to);
    const fromValue = isoToLocalInput(query.from);
    const toValue = isoToLocalInput(query.to);

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <Field className="sm:w-72">
                <FieldLabel htmlFor="audit-action-filter">
                    {t("audit.filters.action")}
                </FieldLabel>
                <Select
                    value={query.action ?? ALL}
                    onValueChange={(next) =>
                        setQuery({ action: next === ALL ? undefined : next })
                    }
                >
                    <SelectTrigger id="audit-action-filter" className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>
                            {t("audit.filters.allActions")}
                        </SelectItem>
                        {AUDIT_ACTIONS.map((action) => (
                            <SelectItem key={action} value={action}>
                                {action}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </Field>
            <Field className="sm:w-56">
                <FieldLabel htmlFor="audit-from-filter">
                    {t("audit.filters.from")}
                </FieldLabel>
                <Input
                    id="audit-from-filter"
                    type="datetime-local"
                    value={fromValue}
                    max={toValue || undefined}
                    onChange={(event) =>
                        setQuery({ from: localInputToIso(event.target.value) })
                    }
                />
            </Field>
            <Field className="sm:w-56">
                <FieldLabel htmlFor="audit-to-filter">
                    {t("audit.filters.to")}
                </FieldLabel>
                <Input
                    id="audit-to-filter"
                    type="datetime-local"
                    value={toValue}
                    min={fromValue || undefined}
                    onChange={(event) =>
                        setQuery({ to: localInputToIso(event.target.value) })
                    }
                />
            </Field>
            {active && (
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                        setQuery({
                            action: undefined,
                            from: undefined,
                            to: undefined,
                        })
                    }
                >
                    {t("audit.filters.clear")}
                </Button>
            )}
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
