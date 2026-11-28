import { apiClient } from "@/lib/apiClient";

/** `GET /learning/me/recommendations` answers `data.recommendations`, best match first; an empty list when absent. */
export async function getRecommendations(targetRole, { signal } = {}) {
    const { data } = await apiClient.get("/learning/me/recommendations", {
        params: { targetRole },
        signal,
    });
    return data?.recommendations ?? [];
}

/** `POST /learning/me/enrolments` is idempotent: enrolling twice returns the same enrolment. */
export async function enrolInCourse(courseId, { signal } = {}) {
    const { data } = await apiClient.post(
        "/learning/me/enrolments",
        { courseId },
        { signal }
    );
    return data?.enrolment ?? null;
}
