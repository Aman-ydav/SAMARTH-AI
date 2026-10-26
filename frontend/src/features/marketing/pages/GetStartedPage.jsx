import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { LoginIcon, MailSendIcon, UserAddIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/features/auth";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { PATHS } from "@/lib/paths";

const INVITATIONS_ID = "invitations";

/** `/get-started` (docs/23 section 6.1): choose how to begin. Links only; Google sign-in itself lives on /login and /signup. */
export default function GetStartedPage() {
    const { t } = useTranslation(["auth", "errors", "common", "nav"]);
    const { isAuthenticated } = useAuth();
    useDocumentTitle(
        t("common:documentTitle", { page: t("common:pages.getStarted") })
    );
    const steps = t("errors:pages.getStarted.invitations.steps", {
        returnObjects: true,
    });

    const options = [
        {
            id: "learner",
            Icon: UserAddIcon,
            title: t("auth:start.learnerTitle"),
            body: t("auth:start.learnerBody"),
            action: (
                <Link to={PATHS.signup}>{t("auth:start.learnerAction")}</Link>
            ),
            hint: t("errors:pages.getStarted.googleHint"),
        },
        {
            id: "invite",
            Icon: MailSendIcon,
            title: t("auth:start.inviteTitle"),
            body: t("auth:start.inviteBody"),
            action: (
                <Link to={{ hash: `#${INVITATIONS_ID}` }}>
                    {t("auth:start.inviteAction")}
                </Link>
            ),
        },
        {
            id: "returning",
            Icon: LoginIcon,
            title: t("auth:start.returningTitle"),
            body: t("auth:start.returningBody"),
            action: (
                <Link to={PATHS.login}>{t("auth:start.returningAction")}</Link>
            ),
        },
    ];

    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 md:py-20 lg:px-8"
        >
            <header className="mx-auto max-w-2xl text-center">
                <h1 className="type-h1 text-balance">
                    {t("auth:start.title")}
                </h1>
                <p className="type-body-lg mt-3 text-muted-foreground">
                    {t("auth:start.subtitle")}
                </p>
            </header>

            {isAuthenticated ? (
                <Card className="mx-auto mt-8 max-w-2xl" data-slot="signed-in">
                    <CardContent className="items-center gap-3 text-center">
                        <h2 className="type-h4">
                            {t("errors:pages.getStarted.signedInTitle")}
                        </h2>
                        <p className="type-small text-muted-foreground">
                            {t("errors:pages.getStarted.signedInBody")}
                        </p>
                        <Button asChild>
                            <Link to={PATHS.dashboard}>
                                {t("nav:openDashboard")}
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            ) : null}

            <section
                aria-label={t("errors:pages.getStarted.optionsLabel")}
                className="mt-10 grid gap-6 md:grid-cols-3"
            >
                {options.map(({ id, Icon, title, body, action, hint }) => (
                    <Card key={id}>
                        <CardHeader>
                            <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                                <Icon aria-hidden="true" className="size-6" />
                            </span>
                            <CardTitle>
                                <h2 className="type-h3">{title}</h2>
                            </CardTitle>
                            <CardDescription>{body}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                asChild
                                variant={
                                    id === "learner" ? "default" : "outline"
                                }
                            >
                                {action}
                            </Button>
                            {hint ? (
                                <p className="type-small text-muted-foreground">
                                    {hint}
                                </p>
                            ) : null}
                        </CardContent>
                    </Card>
                ))}
            </section>

            <section
                id={INVITATIONS_ID}
                aria-labelledby="invitations-title"
                className="mx-auto mt-16 max-w-2xl scroll-mt-24"
            >
                <h2 id="invitations-title" className="type-h2">
                    {t("errors:pages.getStarted.invitations.title")}
                </h2>
                <ol className="type-body mt-4 list-decimal space-y-2 ps-5">
                    {Array.isArray(steps)
                        ? steps.map((step) => <li key={step}>{step}</li>)
                        : null}
                </ol>
                <p className="type-small mt-4 text-muted-foreground">
                    {t("errors:pages.getStarted.invitations.note")}
                </p>
            </section>

            <footer className="mx-auto mt-16 max-w-2xl border-t border-border pt-6 text-center">
                <p className="type-small text-muted-foreground">
                    {t("common:prototypeNotice")}
                </p>
                <p className="type-small mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                    <span className="text-muted-foreground">
                        {t("errors:pages.getStarted.legalLabel")}
                    </span>
                    <Link
                        to={PATHS.terms}
                        className="rounded-sm text-primary-text underline underline-offset-4"
                    >
                        {t("common:pages.terms")}
                    </Link>
                    <Link
                        to={PATHS.privacy}
                        className="rounded-sm text-primary-text underline underline-offset-4"
                    >
                        {t("common:pages.privacy")}
                    </Link>
                </p>
            </footer>
        </main>
    );
}
