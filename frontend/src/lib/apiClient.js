import axios from "axios";
import { env } from "@/lib/env";
import { getCsrfToken } from "@/lib/csrf";
import { apiEvents, API_EVENTS } from "@/lib/apiEvents";
import {
    API_ERROR_CODES,
    ApiError,
    NO_REFRESH_CODES,
    REFRESHABLE_CODES,
    SESSION_ENDING_CODES,
    apiErrorFromResponse,
} from "@/lib/apiError";

const REQUEST_TIMEOUT_MS = 30000;
const WAKING_DELAY_MS = 3000;
const RETRY_DELAYS_MS = [1000, 3000];
const TRANSIENT_STATUS = new Set([502, 503, 504]);
const SAFE_METHODS = new Set(["get", "head"]);
const CSRF_METHODS = new Set(["post", "put", "patch", "delete"]);

/**
 * The one axios instance (FE-38). Per-request behaviour is steered through `config.sai`:
 *  - bootRefresh: allow the single R5 refresh on this /auth/* call (boot GET /auth/me)
 *  - silentSessionEnd: never emit `session-expired` for this call (anonymous boot, internal calls)
 *  - noRetry: skip the GET retry policy
 *  - retried401 / retriedCsrf / retryCount: replay bookkeeping, set by the client itself
 */
export const apiClient = axios.create({
    baseURL: env.apiUrl,
    withCredentials: true,
    timeout: REQUEST_TIMEOUT_MS,
    headers: { Accept: "application/json" },
});

let requestCounter = 0;
function newRequestId() {
    if (typeof globalThis.crypto?.randomUUID === "function")
        return globalThis.crypto.randomUUID();
    requestCounter += 1;
    return `req-${Date.now().toString(36)}-${requestCounter.toString(36)}`;
}

const requestIdOf = (config) => config?.headers?.get?.("X-Request-Id") ?? null;

function authPathOf(url) {
    let path = String(url ?? "").split("?")[0];
    if (/^https?:\/\//i.test(path)) {
        try {
            path = new URL(path).pathname;
        } catch {
            return path;
        }
    }
    if (env.apiUrl.startsWith("/") && path.startsWith(env.apiUrl))
        path = path.slice(env.apiUrl.length);
    return path;
}

const isAuthEndpoint = (url) => authPathOf(url).startsWith("/auth/");

/* "Server is waking up": any request pending longer than 3 s raises the banner event (FE-48). */
const slowTimers = new Map();
const slowActive = new Set();
let wakingRaised = false;

function trackStart(id) {
    if (!id) return;
    slowTimers.set(
        id,
        setTimeout(() => {
            slowActive.add(id);
            if (!wakingRaised) {
                wakingRaised = true;
                apiEvents.emit(API_EVENTS.SERVER_WAKING, { active: true });
            }
        }, WAKING_DELAY_MS)
    );
}

function trackEnd(id) {
    if (!id) return;
    clearTimeout(slowTimers.get(id));
    slowTimers.delete(id);
    slowActive.delete(id);
    if (wakingRaised && slowActive.size === 0) {
        wakingRaised = false;
        apiEvents.emit(API_EVENTS.SERVER_WAKING, { active: false });
    }
}

apiClient.interceptors.request.use((config) => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return Promise.reject(
            new ApiError({ statusCode: 0, code: API_ERROR_CODES.OFFLINE })
        );
    }
    const method = String(config.method || "get").toLowerCase();
    const id = newRequestId();
    config.headers.set("X-Request-Id", id);
    if (CSRF_METHODS.has(method)) {
        const token = getCsrfToken();
        if (token) config.headers.set("X-CSRF-Token", token);
    } else {
        config.headers.delete("X-CSRF-Token");
    }
    trackStart(id);
    return config;
});

async function readBody(response) {
    const { data } = response;
    try {
        if (typeof Blob !== "undefined" && data instanceof Blob)
            return JSON.parse(await data.text());
        if (typeof data === "string") return data ? JSON.parse(data) : {};
    } catch {
        return {};
    }
    return data && typeof data === "object" ? data : {};
}

async function normalizeError(error) {
    if (axios.isCancel(error))
        return new ApiError({
            statusCode: 0,
            code: API_ERROR_CODES.REQUEST_CANCELED,
        });
    if (error?.response) {
        const { response } = error;
        const headers = response.headers ?? {};
        return apiErrorFromResponse(response.status, await readBody(response), {
            retryAfterHeader: headers["retry-after"] ?? null,
            requestIdHeader: headers["x-request-id"] ?? null,
        });
    }
    if (error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT") {
        return new ApiError({ statusCode: 0, code: API_ERROR_CODES.TIMEOUT });
    }
    if (error?.request || error?.code === "ERR_NETWORK") {
        const offline =
            typeof navigator !== "undefined" && navigator.onLine === false;
        return new ApiError({
            statusCode: 0,
            code: offline
                ? API_ERROR_CODES.OFFLINE
                : API_ERROR_CODES.NETWORK_ERROR,
        });
    }
    return new ApiError({ statusCode: 0, code: API_ERROR_CODES.UNKNOWN });
}

function onSuccess(response) {
    trackEnd(requestIdOf(response.config));
    if (response.config?.responseType === "blob") return response;
    if (response.status === 204) return { success: true, data: null };
    const body = response.data;
    if (body && typeof body === "object" && body.success === true) {
        return "data" in body ? body : { ...body, data: null };
    }
    return Promise.reject(
        new ApiError({
            statusCode: response.status,
            code: API_ERROR_CODES.INVALID_RESPONSE,
            requestId: response.headers?.["x-request-id"] ?? null,
        })
    );
}

/* Single-flight refresh: every concurrent 401 shares one POST /auth/refresh (FE-45). */
let refreshInFlight = null;
function refreshSession() {
    if (!refreshInFlight) {
        refreshInFlight = apiClient
            .post("/auth/refresh", null, {
                sai: { silentSessionEnd: true, noRetry: true },
            })
            .finally(() => {
                refreshInFlight = null;
            });
    }
    return refreshInFlight;
}

/* A CSRF failure is fixed by re-reading /auth/me, which makes the server (re)issue the cookie. */
let csrfRefreshInFlight = null;
function refreshCsrfCookie() {
    if (!csrfRefreshInFlight) {
        csrfRefreshInFlight = apiClient
            .get("/auth/me", { sai: { silentSessionEnd: true, noRetry: true } })
            .then(
                () => true,
                (failure) => failure
            )
            .finally(() => {
                csrfRefreshInFlight = null;
            });
    }
    return csrfRefreshInFlight;
}

const endsSession = (apiError) =>
    apiError.statusCode === 401 ||
    apiError.statusCode === 403 ||
    SESSION_ENDING_CODES.includes(apiError.code);

function announceSessionEnd(sai, apiError) {
    if (sai?.silentSessionEnd) return;
    const reason =
        apiError.code === API_ERROR_CODES.SESSION_REVOKED
            ? "SESSION_REVOKED"
            : "SESSION_EXPIRED";
    apiEvents.emit(API_EVENTS.SESSION_EXPIRED, { reason, code: apiError.code });
}

async function handleUnauthorized(config, sai, apiError) {
    const refreshable =
        !sai.retried401 &&
        REFRESHABLE_CODES.includes(apiError.code) &&
        !NO_REFRESH_CODES.includes(apiError.code) &&
        (!isAuthEndpoint(config.url) || sai.bootRefresh === true);

    if (!refreshable) {
        if (SESSION_ENDING_CODES.includes(apiError.code))
            announceSessionEnd(sai, apiError);
        throw apiError;
    }

    try {
        await refreshSession();
    } catch (refreshFailure) {
        if (refreshFailure instanceof ApiError && endsSession(refreshFailure))
            announceSessionEnd(sai, refreshFailure);
        throw refreshFailure;
    }
    return apiClient.request({ ...config, sai: { ...sai, retried401: true } });
}

function wait(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function retryIfTransient(config, sai, apiError) {
    const method = String(config.method || "get").toLowerCase();
    const transient =
        apiError.code === API_ERROR_CODES.NETWORK_ERROR ||
        apiError.code === API_ERROR_CODES.TIMEOUT ||
        TRANSIENT_STATUS.has(apiError.statusCode);
    const attempt = sai.retryCount ?? 0;
    if (
        !SAFE_METHODS.has(method) ||
        !transient ||
        sai.noRetry ||
        attempt >= RETRY_DELAYS_MS.length
    )
        throw apiError;

    await wait(RETRY_DELAYS_MS[attempt] * (0.75 + Math.random() * 0.5));
    if (config.signal?.aborted)
        throw new ApiError({
            statusCode: 0,
            code: API_ERROR_CODES.REQUEST_CANCELED,
        });
    return apiClient.request({
        ...config,
        sai: { ...sai, retryCount: attempt + 1 },
    });
}

async function onFailure(error) {
    if (error?.config) trackEnd(requestIdOf(error.config));
    if (error instanceof ApiError) throw error;

    const apiError = await normalizeError(error);
    const config = error?.config;
    if (!config) throw apiError;
    const sai = config.sai ?? {};

    if (apiError.statusCode === 401)
        return handleUnauthorized(config, sai, apiError);

    if (
        apiError.statusCode === 403 &&
        apiError.code === API_ERROR_CODES.CSRF_INVALID &&
        !sai.retriedCsrf
    ) {
        await refreshCsrfCookie();
        return apiClient.request({
            ...config,
            sai: { ...sai, retriedCsrf: true },
        });
    }

    if (SESSION_ENDING_CODES.includes(apiError.code))
        announceSessionEnd(sai, apiError);
    return retryIfTransient(config, sai, apiError);
}

apiClient.interceptors.response.use(onSuccess, onFailure);
