import { useTranslation } from "react-i18next";
import { HowVisualEvidence } from "@/features/marketing/components/HowVisualEvidence";
import { HowVisualGaps } from "@/features/marketing/components/HowVisualGaps";
import { HowVisualPath } from "@/features/marketing/components/HowVisualPath";
import { HowVisualProfile } from "@/features/marketing/components/HowVisualProfile";

const VISUALS = {
    profile: HowVisualProfile,
    gaps: HowVisualGaps,
    path: HowVisualPath,
    evidence: HowVisualEvidence,
};

/**
 * Product screen for one "How it works" step, built from shadcn components and the shared demo fixture. `active` is
 * true while the step is current (always true when the steps are stacked): bars fill and figures count up then.
 */
export function HowStepVisual({ id, active = true }) {
    const { t } = useTranslation("landing");
    const Visual = VISUALS[id];
    return Visual ? <Visual t={t} active={active} /> : null;
}
