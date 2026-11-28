import { useAuth } from "@/features/auth";
import { HELP_SECTIONS } from "@/features/help/data/helpTopics";
import { hasRole } from "@/lib/permissions";

/** The help sections that apply to the signed-in role, in display order (everyone first, then the role's own areas). */
export function useHelpSections() {
    const { user } = useAuth();
    return HELP_SECTIONS.filter((section) => hasRole(user, section.roles));
}
