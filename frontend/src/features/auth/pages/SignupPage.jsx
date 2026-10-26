import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { useAppSelector } from "@/app/hooks";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { ReactivatedPanel } from "@/features/auth/components/ReactivatedPanel";
import { SignupForm } from "@/features/auth/components/SignupForm";
import { selectJustReactivated } from "@/features/auth/slice/authSlice";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { PATHS } from "@/lib/paths";
import { readReturnTo } from "@/lib/safeRedirect";

const MAX_EMAIL = 254;
const MAX_NAME = 80;
const FIRST_PRINTABLE = 32;
const DELETE_CHAR = 127;

/** A prefill value from the invitation link: short, single line, no control characters; otherwise ignored. */
function cleanPrefill(value, max) {
    const text = (value ?? "").trim();
    if (!text || text.length > max) return "";
    for (const char of text) {
        const code = char.codePointAt(0);
        if (code < FIRST_PRINTABLE || code === DELETE_CHAR) return "";
    }
    return text;
}

export default function SignupPage() {
    const { t } = useTranslation(["auth", "common"]);
    const location = useLocation();
    const reactivated = useAppSelector(selectJustReactivated);
    const params = new URLSearchParams(location.search);
    const defaultValues = {
        name: cleanPrefill(params.get("name"), MAX_NAME),
        email: cleanPrefill(params.get("email"), MAX_EMAIL),
    };
    const carried = readReturnTo(location, null);

    useDocumentTitle(t("common:documentTitle", { page: t("signup.title") }));

    if (reactivated) return <ReactivatedPanel />;

    return (
        <AuthCard
            title={t("signup.title")}
            description={t("signup.subtitle")}
            footer={
                <p>
                    {t("haveAccount")}{" "}
                    <Link
                        to={PATHS.login}
                        state={carried ? { returnTo: carried } : undefined}
                        className="font-medium text-primary-text underline underline-offset-4"
                    >
                        {t("signIn")}
                    </Link>
                </p>
            }
        >
            <SignupForm defaultValues={defaultValues} />
        </AuthCard>
    );
}
