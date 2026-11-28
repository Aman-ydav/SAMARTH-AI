import { apiClient } from "@/lib/apiClient";

export async function getFramework({ signal } = {}) {
    const { data } = await apiClient.get("/competencies/framework", { signal });
    return data?.competencies || [];
}

export async function getRoles({ signal } = {}) {
    const { data } = await apiClient.get("/competencies/roles", { signal });
    return data?.roles || [];
}

export async function getMyGaps(targetRole = "statistical_officer", { signal } = {}) {
    const { data } = await apiClient.get(`/competencies/me/gaps?targetRole=${targetRole}`, { signal });
    return data?.gapAnalysis || null;
}

export async function saveSelfAssessment(ratings, { signal } = {}) {
    const { data } = await apiClient.post("/competencies/me/self-assessment", { ratings }, { signal });
    return data?.competencies || [];
}
