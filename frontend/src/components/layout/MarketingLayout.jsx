import { Suspense } from "react";
import { Outlet } from "react-router";
import { MarketingFooter } from "@/components/layout/MarketingFooter";
import { MarketingNavbar } from "@/components/layout/MarketingNavbar";
import { ScrollProgressBar } from "@/components/motion/ScrollProgressBar";
import { SmoothScroll } from "@/components/motion/SmoothScroll";

/**
 * Frame for public pages (landing, about, legal, start and state pages): progress bar, sticky navbar, the routed
 * page, footer. Every page renders its own main landmark (id main-content, tabIndex -1): the skip link and the focus
 * move after navigation target it, so this layout adds no landmark of its own. Lenis smooth scroll and the progress
 * bar are no-ops on the reduced-motion and lite tiers (ANIM-22). The skip link is rendered once above all layouts by
 * RootLayout. No ancestor of the sticky navbar may set overflow (ANIM-25).
 */
export function MarketingLayout() {
    return (
        <SmoothScroll>
            <ScrollProgressBar />
            <MarketingNavbar />
            <div className="min-h-svh">
                <Suspense fallback={null}>
                    <Outlet />
                </Suspense>
            </div>
            <MarketingFooter />
        </SmoothScroll>
    );
}
