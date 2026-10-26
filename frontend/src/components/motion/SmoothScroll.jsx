import { SmoothScrollProvider } from "@/components/motion/SmoothScrollProvider";

/** Short name for `SmoothScrollProvider`: wrap the marketing layout's content once. */
export function SmoothScroll({ children }) {
    return <SmoothScrollProvider>{children}</SmoothScrollProvider>;
}
