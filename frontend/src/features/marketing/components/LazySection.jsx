import { Suspense, useRef } from "react";
import { useInView } from "motion/react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const MOUNT_MARGIN = "600px 0px 600px 0px";

function SectionSkeleton({ className }) {
    return (
        <div
            aria-hidden="true"
            className={cn(
                "mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:px-6 md:py-20 lg:px-8",
                className
            )}
        >
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-64 w-full" />
        </div>
    );
}

/**
 * Mounts a `React.lazy` section 600 px before it scrolls into view (ANIM-77). The wrapper owns the anchor `id`;
 * `reserve` is a min-height class (for example `min-h-svh`) that holds the space until the section has loaded,
 * so the page length does not jump.
 */
export function LazySection({ id, component: Section, reserve }) {
    const ref = useRef(null);
    const near = useInView(ref, { once: true, margin: MOUNT_MARGIN });
    return (
        <div id={id} ref={ref} aria-busy={!near} className="scroll-mt-16">
            {near ? (
                <Suspense fallback={<SectionSkeleton className={reserve} />}>
                    <Section />
                </Suspense>
            ) : (
                <SectionSkeleton className={reserve} />
            )}
        </div>
    );
}
