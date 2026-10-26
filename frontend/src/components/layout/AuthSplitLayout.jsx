import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation } from "react-router";
import { LanguageSwitch } from "@/components/layout/LanguageSwitch";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Reveal } from "@/components/motion/Reveal";
import { TextReveal } from "@/components/motion/TextReveal";
import { TickerMarquee } from "@/components/motion/TickerMarquee";
import { PATHS } from "@/lib/paths";

const WORD = "SAMARTH";
const SUFFIX = "AI";
const TICKER_SPEED = 24;

const focusRing =
    "rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Flat brand panel (ANIM-54): wordmark, tagline, one principle as a quote, a slow ticker of the SAMARTH topics. */
function BrandPanel() {
    const { t } = useTranslation(["auth", "common", "nav"]);
    const topics = t("auth:layout.ticker", { returnObjects: true });

    return (
        <aside
            aria-label={t("auth:layout.brandLabel")}
            className="hidden flex-col justify-between gap-12 bg-primary p-12 text-primary-foreground lg:flex"
        >
            <div className="flex flex-col gap-6">
                <Link
                    to={PATHS.home}
                    aria-label={t("nav:homeLink")}
                    className="flex w-fit items-baseline gap-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
                >
                    <span
                        aria-hidden="true"
                        className="font-display text-2xl font-semibold tracking-[0.04em]"
                    >
                        {WORD}
                    </span>
                    <span
                        aria-hidden="true"
                        className="font-mono text-sm font-medium"
                    >
                        {SUFFIX}
                    </span>
                </Link>
                <p className="type-body-lg max-w-sm">
                    {t("common:brand.tagline")}
                </p>
            </div>
            <figure className="flex flex-col gap-4">
                <blockquote>
                    <TextReveal
                        as="p"
                        mode="load"
                        text={t("auth:layout.quote")}
                        className="type-h1"
                    />
                </blockquote>
                <figcaption className="type-small">
                    {t("auth:layout.quoteSource")}
                </figcaption>
            </figure>
            <TickerMarquee
                items={Array.isArray(topics) ? topics : []}
                speed={TICKER_SPEED}
                boost={false}
                ariaLabel={t("auth:layout.tickerLabel")}
                pauseLabel={t("auth:layout.pauseTicker")}
                playLabel={t("auth:layout.playTicker")}
            />
        </aside>
    );
}

/**
 * Frame for every auth screen (sign-in, sign-up, email links, session and account state pages). Two columns from
 * `lg`: flat brand panel and the form side; a single column below. Motion is limited to Reveal, TextReveal and
 * the slow ticker (ANIM-54). The layout renders no `<main>`: each page owns its single `<main id="main-content">`
 * (the auth card renders it), so a composed page has exactly one main landmark.
 */
export function AuthSplitLayout() {
    const { t } = useTranslation(["auth", "common", "nav"]);
    const { pathname } = useLocation();

    return (
        <div className="grid min-h-svh bg-background text-foreground lg:grid-cols-2">
            <BrandPanel />
            <div className="flex min-h-svh min-w-0 flex-col">
                <header className="flex items-center justify-between gap-2 px-4 py-4 sm:px-6 lg:justify-end lg:px-8">
                    <Link
                        to={PATHS.home}
                        aria-label={t("nav:homeLink")}
                        className={`${focusRing} lg:hidden`}
                    >
                        <Logo />
                    </Link>
                    <div
                        role="group"
                        aria-label={t("auth:layout.preferences")}
                        className="flex items-center gap-1"
                    >
                        <LanguageSwitch />
                        <ThemeToggle />
                    </div>
                </header>
                <div className="flex flex-1 items-start justify-center px-4 py-6 sm:px-6 lg:items-center lg:px-8">
                    <Reveal key={pathname} className="w-full max-w-md">
                        <Outlet />
                    </Reveal>
                </div>
                <footer className="flex flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:px-6 lg:px-8">
                    <p>{t("common:prototypeNotice")}</p>
                    <nav
                        aria-label={t("auth:layout.legalNav")}
                        className="flex gap-4"
                    >
                        <Link
                            to={PATHS.terms}
                            className={`${focusRing} underline underline-offset-4`}
                        >
                            {t("common:pages.terms")}
                        </Link>
                        <Link
                            to={PATHS.privacy}
                            className={`${focusRing} underline underline-offset-4`}
                        >
                            {t("common:pages.privacy")}
                        </Link>
                    </nav>
                </footer>
            </div>
        </div>
    );
}
