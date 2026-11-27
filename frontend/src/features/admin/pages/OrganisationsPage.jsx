import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { FormFailureAlert } from "@/components/common/FormFailureAlert";
import { LoadErrorAlert } from "@/components/common/LoadErrorAlert";
import { SubmitButton } from "@/components/common/SubmitButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AdminPageFrame } from "@/features/admin/components/AdminPageFrame";
import { ListPagination } from "@/features/admin/components/ListPagination";
import * as adminApi from "@/features/admin/api/adminApi";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { notify } from "@/hooks/useNotify";

const EMPTY_FORM = Object.freeze({
    name: "",
    code: "",
    allowedEmailDomains: "",
    allowSelfRegistration: true,
    requireEmailVerification: true,
    allowGoogleLogin: true,
});

function formValues(organisation) {
    if (!organisation) return { ...EMPTY_FORM };
    return {
        name: organisation.name,
        code: organisation.code,
        allowedEmailDomains:
            organisation.settings.allowedEmailDomains.join(", "),
        allowSelfRegistration: organisation.settings.allowSelfRegistration,
        requireEmailVerification:
            organisation.settings.requireEmailVerification,
        allowGoogleLogin: organisation.settings.allowGoogleLogin,
    };
}

function settingsFromForm(data) {
    return {
        allowSelfRegistration: data.allowSelfRegistration,
        allowedEmailDomains: data.allowedEmailDomains
            .split(",")
            .map((domain) => domain.trim().toLowerCase())
            .filter(Boolean),
        requireEmailVerification: data.requireEmailVerification,
        allowGoogleLogin: data.allowGoogleLogin,
    };
}

function OrganisationForm({
    organisation,
    onCancel,
    onSaved,
    action,
    t,
}) {
    const [values, setValues] = useState(() => formValues(organisation));
    const update = (key, value) =>
        setValues((current) => ({ ...current, [key]: value }));

    async function submit(event) {
        event.preventDefault();
        const body = {
            name: values.name.trim(),
            code: values.code.trim().toLowerCase(),
            settings: settingsFromForm(values),
            ...(organisation ? { expectedVersion: organisation.version } : {}),
        };
        await action.run(async () => {
            const saved = organisation
                ? await adminApi.updateOrganisation({
                      id: organisation.id,
                      ...body,
                  })
                : await adminApi.createOrganisation(body);
            if (!saved) throw adminApi.invalidResponse();
            await notify(
                "success",
                t(
                    organisation
                        ? "admin:organisations.updated"
                        : "admin:organisations.created",
                    { name: saved.name }
                ),
                `organisation-saved-${saved.id}`
            );
            if (!organisation) setValues({ ...EMPTY_FORM });
            onSaved(saved);
        });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="type-h3">
                    {t(
                        organisation
                            ? "admin:organisations.editTitle"
                            : "admin:organisations.createTitle"
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form
                    noValidate
                    onSubmit={submit}
                    aria-busy={action.pending}
                    className="flex flex-col gap-5"
                >
                    <fieldset
                        disabled={action.pending}
                        className="grid gap-4 md:grid-cols-2"
                    >
                        <Field>
                            <FieldLabel htmlFor="organisation-name">
                                {t("admin:organisations.name")}
                            </FieldLabel>
                            <Input
                                id="organisation-name"
                                required
                                minLength={2}
                                maxLength={120}
                                value={values.name}
                                onChange={(event) =>
                                    update("name", event.target.value)
                                }
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="organisation-code">
                                {t("admin:organisations.code")}
                            </FieldLabel>
                            <Input
                                id="organisation-code"
                                required
                                minLength={2}
                                maxLength={20}
                                pattern="[a-zA-Z0-9]+([\-][a-zA-Z0-9]+)*"
                                value={values.code}
                                onChange={(event) =>
                                    update("code", event.target.value)
                                }
                            />
                        </Field>
                        <Field className="md:col-span-2">
                            <FieldLabel htmlFor="organisation-domains">
                                {t("admin:organisations.domains")}
                            </FieldLabel>
                            <Input
                                id="organisation-domains"
                                placeholder="example.gov.in, example.nic.in"
                                value={values.allowedEmailDomains}
                                onChange={(event) =>
                                    update(
                                        "allowedEmailDomains",
                                        event.target.value
                                    )
                                }
                            />
                            <p className="text-sm text-muted-foreground">
                                {t("admin:organisations.domainsHint")}
                            </p>
                        </Field>
                        {[
                            [
                                "allowSelfRegistration",
                                "admin:organisations.selfRegistration",
                            ],
                            [
                                "requireEmailVerification",
                                "admin:organisations.emailVerification",
                            ],
                            ["allowGoogleLogin", "admin:organisations.google"],
                        ].map(([key, label]) => (
                            <Field
                                key={key}
                                className="flex-row items-center justify-between"
                            >
                                <FieldLabel htmlFor={`organisation-${key}`}>
                                    {t(label)}
                                </FieldLabel>
                                <Switch
                                    id={`organisation-${key}`}
                                    checked={values[key]}
                                    onCheckedChange={(checked) =>
                                        update(key, checked)
                                    }
                                />
                            </Field>
                        ))}
                    </fieldset>
                    <FormFailureAlert
                        failure={action.failure}
                        cooldownSec={action.cooldownSec}
                    />
                    <div className="flex flex-wrap gap-2">
                        <SubmitButton
                            pending={action.pending}
                            disabled={
                                !values.name.trim() ||
                                !values.code.trim() ||
                                action.cooldownSec > 0
                            }
                            className="w-auto"
                        >
                            {t("admin:organisations.save")}
                        </SubmitButton>
                        {organisation && (
                            <Button
                                type="button"
                                variant="outline"
                                disabled={action.pending}
                                onClick={onCancel}
                            >
                                {t("common:cancel")}
                            </Button>
                        )}
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

export default function OrganisationsPage() {
    const { t } = useTranslation(["admin", "common", "errors"]);
    const [organisations, setOrganisations] = useState([]);
    const [status, setStatus] = useState("active");
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
    });
    const [loadState, setLoadState] = useState({ key: null, error: null });
    const [editing, setEditing] = useState(null);
    const [deactivating, setDeactivating] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const action = useAsyncAction();
    const requestKey = `${status}:${page}:${refreshKey}`;
    const loading = loadState.key !== requestKey;
    const loadError =
        loadState.key === requestKey ? loadState.error : null;

    useDocumentTitle(
        t("common:documentTitle", {
            page: t("admin:organisations.title"),
        })
    );

    const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

    useEffect(() => {
        const controller = new AbortController();
        adminApi
            .listOrganisations(
                { status, page, limit: 20 },
                { signal: controller.signal }
            )
            .then(({ items, meta: nextMeta }) => {
                setOrganisations(items);
                setMeta(nextMeta);
                setLoadState({ key: requestKey, error: null });
            })
            .catch((error) => {
                if (!controller.signal.aborted) {
                    setLoadState({ key: requestKey, error });
                }
            });
        return () => controller.abort();
    }, [status, page, requestKey]);

    async function setActive(organisation, active) {
        await action.run(async () => {
            const updated = active
                ? await adminApi.restoreOrganisation({ id: organisation.id })
                : await adminApi.deactivateOrganisation({
                      id: organisation.id,
                  });
            if (!updated) throw adminApi.invalidResponse();
            await notify(
                "success",
                t(
                    active
                        ? "admin:organisations.restored"
                        : "admin:organisations.deactivated",
                    { name: updated.name }
                ),
                `organisation-state-${updated.id}`
            );
            setDeactivating(null);
            refresh();
        });
    }

    return (
        <AdminPageFrame
            title={t("admin:organisations.title")}
            description={t("admin:organisations.subtitle")}
        >
            {!editing && (
                <OrganisationForm
                    action={action}
                    t={t}
                    onSaved={() => {
                        refresh();
                        setPage(1);
                    }}
                />
            )}
            {editing && (
                <OrganisationForm
                    key={editing.id}
                    organisation={editing}
                    action={action}
                    t={t}
                    onCancel={() => {
                        setEditing(null);
                        action.clearFailure();
                    }}
                    onSaved={() => {
                        setEditing(null);
                        refresh();
                    }}
                />
            )}
            <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="type-h2">{t("admin:organisations.listTitle")}</h2>
                <Field className="w-48">
                    <FieldLabel htmlFor="organisation-status">
                        {t("admin:organisations.statusLabel")}
                    </FieldLabel>
                    <select
                        id="organisation-status"
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={status}
                        onChange={(event) => {
                            setStatus(event.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="active">
                            {t("admin:organisations.active")}
                        </option>
                        <option value="inactive">
                            {t("admin:organisations.inactive")}
                        </option>
                    </select>
                </Field>
            </div>
            {loadError ? (
                <LoadErrorAlert error={loadError} onRetry={refresh} />
            ) : loading ? (
                <p role="status">{t("admin:loading")}</p>
            ) : organisations.length === 0 ? (
                <p>{t("admin:organisations.empty")}</p>
            ) : (
                <div className="grid gap-3">
                    {organisations.map((organisation) => (
                        <Card key={organisation.id}>
                            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                                <div className="min-w-0">
                                    <h3 className="font-semibold">
                                        {organisation.name}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        {t("admin:organisations.codeValue", {
                                            code: organisation.code,
                                        })}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {organisation.settings
                                            .allowedEmailDomains.length > 0
                                            ? organisation.settings.allowedEmailDomains.join(
                                                  ", "
                                              )
                                            : t(
                                                  "admin:organisations.allDomains"
                                              )}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                            setEditing(organisation)
                                        }
                                    >
                                        {t("admin:organisations.edit")}
                                    </Button>
                                    {organisation.active &&
                                    organisation.code !== "default" ? (
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            disabled={action.pending}
                                            onClick={() =>
                                                setDeactivating(organisation)
                                            }
                                        >
                                            {t(
                                                "admin:organisations.deactivate"
                                            )}
                                        </Button>
                                    ) : !organisation.active ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={action.pending}
                                            onClick={() =>
                                                setActive(organisation, true)
                                            }
                                        >
                                            {t("admin:organisations.restore")}
                                        </Button>
                                    ) : null}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
            {!loadError && meta.totalPages > 1 && (
                <ListPagination
                    meta={meta}
                    disabled={loading}
                    onPageChange={setPage}
                />
            )}
            <ConfirmActionDialog
                open={deactivating !== null}
                onOpenChange={(open) => {
                    if (!open) setDeactivating(null);
                }}
                destructive
                title={t("admin:organisations.deactivateTitle", {
                    name: deactivating?.name ?? "",
                })}
                description={t("admin:organisations.deactivateBody")}
                actionLabel={t("admin:organisations.deactivate")}
                onConfirm={() => setActive(deactivating, false)}
            />
        </AdminPageFrame>
    );
}
