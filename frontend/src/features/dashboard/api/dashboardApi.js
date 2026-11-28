import { getMyGaps } from "@/features/competencies";
import { apiClient } from "@/lib/apiClient";

/** `GET /competencies/me/gaps` answers `data.gapAnalysis` (readinessScore plus a gaps list); null when absent. */
export const getGapAnalysis = (targetRole, options) =>
    getMyGaps(targetRole, options);

/** `GET /learning/me/learning-path` answers `data.learningPath.totalHours`; null when the response has none. */
export async function getPlannedHours({ signal } = {}) {
    const { data } = await apiClient.get("/learning/me/learning-path", {
        signal,
    });
    const hours = data?.learningPath?.totalHours;
    return Number.isFinite(hours) ? hours : null;
}
