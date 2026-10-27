import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshIcon, SearchIcon } from "@/components/icons";
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
import { SEARCH_MAX_LENGTH } from "@/features/admin/schemas/adminSchemas";
import { useDebounce } from "@/hooks/useDebounce";
import { ROLES } from "@/lib/permissions";

const ALL = "all";
/* Label keys are written out (FE-83) so the key checker sees them. */
const ROLE_OPTIONS = [
    [ROLES.LEARNER, "common:role.learner"],
    [ROLES.TRAINER, "common:role.trainer"],
    [ROLES.ADMIN, "common:role.admin"],
];
const PLATFORM_OPTION = [ROLES.SUPERADMIN, "common:role.superadmin"];
const STATUS_OPTIONS = [
    ["active", "users.status.active"],
    ["suspended", "users.status.suspended"],
    ["pending_verification", "users.status.pending_verification"],
    ["deactivated", "users.status.deactivated"],
    ["pending_deletion", "users.status.pending_deletion"],
];

function FilterSelect({ id, label, value, allLabel, options, onChange }) {
    const { t } = useTranslation("admin");
    return (
        <Field className="sm:w-48">
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Select
                value={value ?? ALL}
                onValueChange={(next) =>
                    onChange(next === ALL ? undefined : next)
                }
            >
                <SelectTrigger id={id} className="w-full">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL}>{allLabel}</SelectItem>
                    {options.map(([option, optionLabel]) => (
                        <SelectItem key={option} value={option}>
                            {t(optionLabel)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </Field>
    );
}

/**
 * Search (email prefix, debounced 300 ms and capped at 64 characters like the API), role and status filters, Clear and
 * Refresh. The values live in the URL (FE-26); the platform-admin role is offered to platform admins only because the
 * API hides those accounts from admins.
 */
export function UserFilters({
    query,
    setQuery,
    canSeePlatformAdmins,
    loading,
    onRefresh,
}) {
    const { t } = useTranslation("admin");
    const [search, setSearch] = useState(query.q ?? "");
    const debounced = useDebounce(search, 300);
    const sent = useRef(query.q ?? "");

    useEffect(() => {
        if (debounced === sent.current) return;
        sent.current = debounced;
        setQuery({ q: debounced.trim() || undefined });
    }, [debounced, setQuery]);

    const active = Boolean(query.q || query.role || query.status);
    const clear = () => {
        sent.current = "";
        setSearch("");
        setQuery({ q: undefined, role: undefined, status: undefined });
    };
    const roleOptions = canSeePlatformAdmins
        ? [...ROLE_OPTIONS, PLATFORM_OPTION]
        : ROLE_OPTIONS;

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <Field className="sm:w-72">
                <FieldLabel htmlFor="users-search">
                    {t("users.search.label")}
                </FieldLabel>
                <div className="relative">
                    <SearchIcon
                        aria-hidden="true"
                        className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                        id="users-search"
                        type="search"
                        value={search}
                        maxLength={SEARCH_MAX_LENGTH}
                        placeholder={t("users.search.placeholder")}
                        className="ps-9"
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>
            </Field>
            <FilterSelect
                id="users-role-filter"
                label={t("users.filters.role")}
                allLabel={t("users.filters.allRoles")}
                value={query.role}
                options={roleOptions}
                onChange={(role) => setQuery({ role })}
            />
            <FilterSelect
                id="users-status-filter"
                label={t("users.filters.status")}
                allLabel={t("users.filters.allStatuses")}
                value={query.status}
                options={STATUS_OPTIONS}
                onChange={(status) => setQuery({ status })}
            />
            {active && (
                <Button type="button" variant="ghost" onClick={clear}>
                    {t("users.filters.clear")}
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
