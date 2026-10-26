import { Suspense, lazy } from "react";

const StatusIcon = lazy(() => import("@/app/providers/StatusIcon"));

/** Decorative icon that loads after first paint; reserves its box so nothing shifts when it arrives. */
export function LazyStatusIcon({ name, className }) {
    return (
        <Suspense
            fallback={
                <span
                    aria-hidden="true"
                    className={`inline-block ${className ?? ""}`}
                />
            }
        >
            <StatusIcon name={name} className={className} />
        </Suspense>
    );
}
