import { apiClient } from "@/lib/apiClient";

/*
 * Profile and avatar endpoints (doc 08 sections 4 and 6). `GET/PUT /profile` answer `data.user` = the auth user summary plus
 * `timezone`; `PUT/DELETE /me/avatar` answer `data.user` = the summary alone. Every function takes `(args, { signal })`.
 */

const UPLOAD_TIMEOUT_MS = 120000;
const withSignal = (signal, extra = {}) => ({ signal, ...extra });

/**
 * Defensive read of a profile response (FE-37): the summary without `timezone`, and the timezone on its own, so the
 * `auth` user keeps exactly the `/auth/me` shape (FE-52). Returns null when the response has no user.
 */
export function readProfileUser(data) {
    const source =
        data?.user && typeof data.user === "object" ? data.user : null;
    if (!source) return null;
    const { timezone, ...user } = source;
    return {
        user,
        timezone: typeof timezone === "string" && timezone ? timezone : null,
    };
}

export async function getProfile({ signal } = {}) {
    const { data } = await apiClient.get("/profile", withSignal(signal));
    return data;
}

export async function updateProfile(body, { signal } = {}) {
    const { data } = await apiClient.put("/profile", body, withSignal(signal));
    return data;
}

/** Multipart upload (field `file`) with progress; the browser sets the boundary, so no Content-Type is given (FE-50). */
export async function uploadAvatar({ file }, { signal, onProgress } = {}) {
    const body = new FormData();
    body.append("file", file);
    const { data } = await apiClient.put(
        "/me/avatar",
        body,
        withSignal(signal, {
            timeout: UPLOAD_TIMEOUT_MS,
            onUploadProgress: (event) => {
                if (event.total > 0)
                    onProgress?.(
                        Math.min(
                            100,
                            Math.round((event.loaded / event.total) * 100)
                        )
                    );
            },
        })
    );
    return data;
}

export async function removeAvatar({ signal } = {}) {
    const { data } = await apiClient.delete("/me/avatar", withSignal(signal));
    return data;
}
