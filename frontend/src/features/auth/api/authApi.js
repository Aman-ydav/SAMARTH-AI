import { apiClient } from "@/lib/apiClient";
import { API_ERROR_CODES, toApiError } from "@/lib/apiError";

/*
 * Auth endpoints (doc 08 section 3). Every function takes `(args, { signal })` and returns the
 * unwrapped `data` of the success envelope. Tokens never appear in a response body; one-time email
 * tokens travel only in POST bodies (R34).
 */

const withSignal = (signal, extra = {}) => ({ signal, ...extra });

export async function register(body, { signal } = {}) {
    const { data, message } = await apiClient.post(
        "/auth/register",
        body,
        withSignal(signal)
    );
    return { ...(data ?? {}), message };
}

export async function verifyEmail({ token }, { signal } = {}) {
    const { data } = await apiClient.post(
        "/auth/verify-email",
        { token },
        withSignal(signal)
    );
    return data;
}

export async function resendVerification({ email }, { signal } = {}) {
    const { message } = await apiClient.post(
        "/auth/resend-verification",
        { email },
        withSignal(signal)
    );
    return { message };
}

export async function login(body, { signal } = {}) {
    const { data } = await apiClient.post(
        "/auth/login",
        body,
        withSignal(signal)
    );
    return data;
}

export async function loginWithGoogle(body, { signal } = {}) {
    const { data } = await apiClient.post(
        "/auth/google",
        body,
        withSignal(signal)
    );
    return data;
}

export async function unlinkGoogle(body, { signal } = {}) {
    const { data } = await apiClient.delete(
        "/auth/google",
        withSignal(signal, { data: body })
    );
    return data;
}

export async function refresh({ signal } = {}) {
    const { data } = await apiClient.post(
        "/auth/refresh",
        null,
        withSignal(signal)
    );
    return data;
}

export async function logout({ signal } = {}) {
    await apiClient.post("/auth/logout", null, withSignal(signal));
    return null;
}

export async function logoutAll({ signal } = {}) {
    await apiClient.post("/auth/logout-all", null, withSignal(signal));
    return null;
}

/** `boot` lets this one /auth/* call do the single R5 refresh; `silent` keeps an anonymous visitor from seeing a session-expired event. */
export async function getMe(
    { boot = false, silent = false } = {},
    { signal } = {}
) {
    const { data } = await apiClient.get(
        "/auth/me",
        withSignal(signal, {
            sai: { bootRefresh: boot, silentSessionEnd: silent },
        })
    );
    return data;
}

export async function forgotPassword({ email }, { signal } = {}) {
    const { message } = await apiClient.post(
        "/auth/forgot-password",
        { email },
        withSignal(signal)
    );
    return { message };
}

export async function validateResetToken({ token }, { signal } = {}) {
    const { data } = await apiClient.post(
        "/auth/reset-password/validate",
        { token },
        withSignal(signal)
    );
    return data;
}

export async function resetPassword(body, { signal } = {}) {
    const { message } = await apiClient.post(
        "/auth/reset-password",
        body,
        withSignal(signal)
    );
    return { message };
}

export async function changePassword(body, { signal } = {}) {
    const { data } = await apiClient.post(
        "/auth/change-password",
        body,
        withSignal(signal)
    );
    return data;
}

export async function changeEmail(body, { signal } = {}) {
    const { message } = await apiClient.post(
        "/auth/change-email",
        body,
        withSignal(signal)
    );
    return { message };
}

export async function confirmEmailChange({ token }, { signal } = {}) {
    const { data } = await apiClient.post(
        "/auth/change-email/confirm",
        { token },
        withSignal(signal)
    );
    return data;
}

export async function undoEmailChange({ token }, { signal } = {}) {
    const { data } = await apiClient.post(
        "/auth/change-email/undo",
        { token },
        withSignal(signal)
    );
    return data;
}

export async function acceptInvite(body, { signal } = {}) {
    const { data } = await apiClient.post(
        "/auth/accept-invite",
        body,
        withSignal(signal)
    );
    return data;
}

export async function listSessions({ signal } = {}) {
    const { data } = await apiClient.get("/auth/sessions", withSignal(signal));
    return Array.isArray(data) ? data : (data?.items ?? []);
}

export async function revokeSession({ id }, { signal } = {}) {
    await apiClient.delete(
        `/auth/sessions/${encodeURIComponent(id)}`,
        withSignal(signal)
    );
    return null;
}

export async function deleteAccount(body, { signal } = {}) {
    const { data } = await apiClient.delete(
        "/auth/account",
        withSignal(signal, { data: body })
    );
    return data;
}

/** Defensive read of a login-type response (FE-37): the user summary plus the flags the UI needs. */
export function readSession(data) {
    const user = data?.user && typeof data.user === "object" ? data.user : null;
    if (!user) return null;
    return {
        user: {
            ...user,
            needsOnboarding: Boolean(
                data.needsOnboarding ?? user.needsOnboarding
            ),
        },
        reactivate: data.reactivate === true,
    };
}

/** Rejection payload for a 2xx response that lacks the expected fields. */
export const invalidResponse = () =>
    toApiError({ statusCode: 200, code: API_ERROR_CODES.INVALID_RESPONSE });
