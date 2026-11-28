import { apiClient } from "@/lib/apiClient";

/** `GET /competencies/me` answers `data.competencies`: every competency with the learner's level, confidence and evidence. */
export async function getMyCompetencies({ signal } = {}) {
    const { data } = await apiClient.get("/competencies/me", { signal });
    return Array.isArray(data?.competencies) ? data.competencies : [];
}
