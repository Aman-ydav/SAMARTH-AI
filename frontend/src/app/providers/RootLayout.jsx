import { Suspense, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
    Outlet,
    ScrollRestoration,
    useLocation,
    useMatches,
} from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { BootGate } from "@/app/providers/BootGate";
import { BootSplash } from "@/app/providers/BootSplash";
import { StatusBanners } from "@/app/providers/StatusBanners";
import { SkipLink } from "@/components/layout/SkipLink";
import { fetchCurrentUser, selectIsAuthenticated } from "@/features/auth";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useRevalidateOnFocus } from "@/hooks/useRevalidateOnFocus";

/**
 * Top of every route tree (FE-70): hydration gate, skip link, banners, one ScrollRestoration, focus moved to
 * <main id="main-content"> after navigation, document title from the route `handle.title` i18n key, and
 * `/auth/me` revalidation when the tab becomes visible again after 5 minutes (FE-60).
 */
export function RootLayout() {
    const { t } = useTranslation(["common", "nav"]);
    const dispatch = useAppDispatch();
    const signedIn = useAppSelector(selectIsAuthenticated);
    const { pathname } = useLocation();
    const matches = useMatches();
    const firstRender = useRef(true);

    const titleKey = matches.findLast((match) => match.handle?.title)?.handle
        .title;
    useDocumentTitle(
        titleKey ? t("documentTitle", { page: t(titleKey) }) : t("brand.name")
    );

    useRevalidateOnFocus(() => {
        if (signedIn) dispatch(fetchCurrentUser({ force: true }));
    });

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        document.getElementById("main-content")?.focus({ preventScroll: true });
    }, [pathname]);

    return (
        <>
            <BootGate>
                <SkipLink />
                <StatusBanners />
                <Suspense fallback={<BootSplash />}>
                    <Outlet />
                </Suspense>
            </BootGate>
            <ScrollRestoration />
        </>
    );
}
