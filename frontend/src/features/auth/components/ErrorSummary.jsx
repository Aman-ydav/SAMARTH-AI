import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ErrorIcon } from "@/components/icons";
import { authFieldId } from "@/features/auth/hooks/useAuthFormSubmit";
import { useFormMessage } from "@/features/auth/hooks/useFormMessage";

/**
 * Error summary for longer forms (FE-79): after a failed submit it takes focus, lists every problem and each
 * entry moves focus to its field. `focusSignal` is a counter the form bumps on each invalid submit.
 */
export function ErrorSummary({ errors, labels, onSelect, focusSignal }) {
    const { t } = useTranslation("auth");
    const message = useFormMessage();
    const headingId = useId();
    const container = useRef(null);
    const items = Object.entries(errors).filter(
        ([name, error]) => name !== "root" && error?.message
    );
    const hasItems = items.length > 0;

    useEffect(() => {
        if (focusSignal > 0 && hasItems) container.current?.focus();
    }, [focusSignal, hasItems]);

    if (!hasItems) return null;

    return (
        <div
            ref={container}
            tabIndex={-1}
            role="group"
            aria-labelledby={headingId}
            className="rounded-lg border border-destructive-border bg-destructive-subtle p-4 text-sm text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <h2 id={headingId} className="flex items-center gap-2 font-medium">
                <ErrorIcon aria-hidden="true" className="size-4 shrink-0" />
                {t("summary.title", { count: items.length })}
            </h2>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-9">
                {items.map(([name, error]) => (
                    <li key={name}>
                        <a
                            href={`#${authFieldId(name)}`}
                            className="underline underline-offset-4"
                            onClick={(event) => {
                                event.preventDefault();
                                onSelect(name);
                            }}
                        >
                            {labels[name] ?? name}: {message(error.message)}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}
