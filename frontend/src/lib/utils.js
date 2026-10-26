import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names; later classes win over earlier conflicting ones. */
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
