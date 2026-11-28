import { apiClient } from "@/lib/apiClient";

/** `PATCH /profile/onboarding` answers `data.user` (the profile with the onboarding fields). */
export async function saveOnboardingProfile(body, { signal } = {}) {
    const { data } = await apiClient.patch("/profile/onboarding", body, {
        signal,
    });
    return data?.user ?? null;
}
