import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, isRouteErrorResponse, useRouteError } from "react-router";
import { Button } from "@/components/ui/button";
import { LazyStatusIcon } from "@/app/providers/LazyStatusIcon";
import { PATHS } from "@/lib/paths";
import { logger } from "@/lib/logger";
import { storage } from "@/lib/storage";

const CHUNK_FAILURE =
    /dynamically imported module|importing a module script failed|loading chunk|error loading dynamically/i;

const isChunkFailure = (error) =>
    error instanceof Error && CHUNK_FAILURE.test(error.message);

const VIEWS = {
    newVersion: {
        icon: "refresh",
        title: "newVersion.title",
        body: "newVersion.body",
    },
    notFound: {
        icon: "help",
        title: "notFound.title",
        body: "notFound.body",
    },
    unauthorized: {
        icon: "forbid",
        title: "unauthorized.title",
        body: "unauthorized.body",
    },
    serverError: {
        icon: "errorWarning",
        title: "serverError.title",
        body: "serverError.body",
    },
};

function viewKind(error) {
    if (isChunkFailure(error)) return "newVersion";
    if (isRouteErrorResponse(error) && error.status === 404) return "notFound";
    if (isRouteErrorResponse(error) && error.status === 403)
        return "unauthorized";
    return "serverError";
}

/**
 * Error element for every route tree (FE-68): 404, 403 and 500 views with a way home. A failed dynamic import
 * means a new deploy, so the page reloads once (guarded by a tab-scoped flag) before offering a manual reload.
 */
export function RouteErrorBoundary() {
    const { t } = useTranslation("errors");
    const error = useRouteError();
    const kind = viewKind(error);
    const { icon, title, body } = VIEWS[kind];
    const chunkFailure = kind === "newVersion";
    const alreadyReloaded =
        chunkFailure && storage.get("sai-chunk-reload") !== null;

    useEffect(() => {
        if (chunkFailure && !alreadyReloaded) {
            storage.set("sai-chunk-reload", "1");
            window.location.reload();
        } else if (!chunkFailure && kind === "serverError") {
            logger.error("Route error boundary", {
                name: error?.name,
                route: window.location.pathname,
            });
        }
    }, [chunkFailure, alreadyReloaded, kind, error]);

    if (chunkFailure && !alreadyReloaded) return null;

    const requestId =
        typeof error?.requestId === "string" ? error.requestId : null;
    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground"
        >
            <LazyStatusIcon
                name={icon}
                className="size-10 text-muted-foreground"
            />
            <h1 className="text-2xl font-semibold">{t(title)}</h1>
            <p className="max-w-md text-muted-foreground">{t(body)}</p>
            {requestId ? (
                <p className="text-sm text-muted-foreground">
                    {t("requestId", { id: requestId })}
                </p>
            ) : null}
            <div className="flex flex-wrap justify-center gap-2">
                {chunkFailure ? (
                    <Button onClick={() => window.location.reload()}>
                        {t("newVersion.reload")}
                    </Button>
                ) : (
                    <Button asChild>
                        <Link
                            to={
                                kind === "unauthorized"
                                    ? PATHS.dashboard
                                    : PATHS.home
                            }
                        >
                            {kind === "unauthorized"
                                ? t("unauthorized.primary")
                                : t("notFound.primary")}
                        </Link>
                    </Button>
                )}
            </div>
        </main>
    );
}
