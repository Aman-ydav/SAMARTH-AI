/**
 * Shows a toast. The toast library is imported on demand so it stays out of the entry chunk (FE-111); the single
 * Toaster is mounted by the app providers. `id` deduplicates toasts per cause (FE-107). Text must already be translated.
 */
export async function notify(type, message, id) {
    const { toast } = await import("sonner");
    toast[type](message, id ? { id } : undefined);
}

/** Stable `notify` for components; kept as a hook so call sites read like the other feature hooks. */
export function useNotify() {
    return notify;
}
