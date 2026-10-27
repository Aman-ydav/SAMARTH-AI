import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { LanguageSwitch } from "@/components/layout/LanguageSwitch";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { DEFAULT_TIME_ZONE, resolveLocale } from "@/lib/format";
import { PATHS } from "@/lib/paths";

/* Footer link groups (docs/23 landing.footer). Anchors point at landing sections; `labelKey` lives in `footer`. */
const COLUMNS = [
    {
        id: "product",
        titleKey: "product.title",
        links: [
            {
                to: { pathname: PATHS.home, hash: "#how" },
                key: "product.howItWorks",
            },
            {
                to: { pathname: PATHS.home, hash: "#features" },
                key: "product.assessment",
            },
            {
                to: { pathname: PATHS.home, hash: "#features" },
                key: "product.mapping",
            },
            {
                to: { pathname: PATHS.home, hash: "#features" },
                key: "product.recommendations",
            },
            {
                to: { pathname: PATHS.home, hash: "#features" },
                key: "product.dashboards",
            },
        ],
    },
    {
        id: "company",
        titleKey: "company.title",
        links: [
            { to: PATHS.about, key: "company.about" },
            { to: { pathname: PATHS.home, hash: "#faq" }, key: "company.faq" },
            { to: PATHS.getStarted, key: "company.getStarted" },
        ],
    },
    {
        id: "legal",
        titleKey: "legal.title",
        links: [
            { to: PATHS.privacy, key: "legal.privacy" },
            { to: PATHS.terms, key: "legal.terms" },
            {
                to: { pathname: PATHS.privacy, hash: "#cookies" },
                key: "legal.cookies",
            },
        ],
    },
];

/** Public footer (docs/23): link columns (the link to the current page carries aria-current), language and theme, legal links, the prototype disclaimer and the current year via Intl. */
export function MarketingFooter() {
    const { t, i18n } = useTranslation("footer");
    const { pathname } = useLocation();
    const year = new Intl.DateTimeFormat(resolveLocale(i18n.language), {
        year: "numeric",
        timeZone: DEFAULT_TIME_ZONE,
    }).format(new Date());

    return (
        <footer className="border-t border-border bg-background">
            <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
                <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_minmax(0,1fr)]">
                    <div className="flex flex-col gap-3">
                        <Link to={PATHS.home} className="w-fit rounded-md">
                            <Logo />
                        </Link>
                        <p className="max-w-xs text-sm text-muted-foreground">
                            {t("common:brand.tagline")}
                        </p>
                    </div>
                    <nav
                        aria-label={t("navLabel")}
                        className="grid gap-8 sm:grid-cols-3 lg:col-span-3"
                    >
                        {COLUMNS.map((column) => (
                            <div key={column.id}>
                                <h2 className="type-small font-semibold text-foreground">
                                    {t(column.titleKey)}
                                </h2>
                                <ul className="mt-3 flex flex-col gap-1">
                                    {column.links.map((link) => (
                                        <li key={link.key}>
                                            <Link
                                                to={link.to}
                                                aria-current={
                                                    link.to === pathname
                                                        ? "page"
                                                        : undefined
                                                }
                                                className="inline-flex min-h-8 items-center rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:underline-offset-4"
                                            >
                                                {t(link.key)}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </nav>
                    <div>
                        <h2 className="type-small font-semibold text-foreground">
                            {t("contact.title")}
                        </h2>
                        <p className="mt-3 text-sm text-muted-foreground">
                            {t("contact.pending")}
                        </p>
                    </div>
                </div>
                <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6">
                    <div
                        role="group"
                        aria-label={t("preferences")}
                        className="flex flex-wrap items-center gap-2"
                    >
                        <LanguageSwitch showLabel />
                        <ThemeToggle />
                    </div>
                    <p className="max-w-prose text-sm text-muted-foreground">
                        {t("disclaimer")}
                    </p>
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:gap-4">
                        <p>{t("copyright", { year })}</p>
                        <p>{t("demoData")}</p>
                    </div>
                </div>
            </div>
        </footer>
    );
}
