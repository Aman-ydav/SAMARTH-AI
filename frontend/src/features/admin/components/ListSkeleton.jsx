import { Skeleton } from "@/components/ui/skeleton";

/** Loading placeholder for a list, announced once as a status instead of once per bar. */
export function ListSkeleton({ label, rows = 5 }) {
    return (
        <div role="status" aria-label={label} className="flex flex-col gap-2">
            {Array.from({ length: rows }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
            ))}
        </div>
    );
}
