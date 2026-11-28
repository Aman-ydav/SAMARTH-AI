import { apiClient } from "@/lib/apiClient";

/* Assessment endpoints. The server decides every score; the client only sends answers and shows what comes back. */

export async function listQuizzes({ signal } = {}) {
    const { data } = await apiClient.get("/assessment/quizzes", { signal });
    return Array.isArray(data?.quizzes) ? data.quizzes : [];
}

/** Questions arrive without correct answers. */
export async function getQuiz(id, { signal } = {}) {
    const { data } = await apiClient.get(
        `/assessment/quizzes/${encodeURIComponent(id)}`,
        { signal }
    );
    return data?.quiz ?? null;
}

/** `answers`: `[{ questionId, selectedOptionIndex }]`. Answers `data.result`. */
export async function submitAttempt(id, answers, { signal } = {}) {
    const { data } = await apiClient.post(
        `/assessment/quizzes/${encodeURIComponent(id)}/attempts`,
        { answers },
        { signal }
    );
    return data?.result ?? null;
}

export async function listMyAttempts({ signal } = {}) {
    const { data } = await apiClient.get("/assessment/me/attempts", { signal });
    return Array.isArray(data?.attempts) ? data.attempts : [];
}
