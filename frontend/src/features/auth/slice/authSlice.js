import {
    createAsyncThunk,
    createSelector,
    createSlice,
} from "@reduxjs/toolkit";
import { API_ERROR_CODES, toApiError } from "@/lib/apiError";
import {
    TTL,
    addOpMatchers,
    asyncInitial,
    isFresh,
    opInitial,
    STATUS,
} from "@/lib/asyncState";
import * as authApi from "@/features/auth/api/authApi";
import {
    changePassword,
    deleteAccount,
    unlinkGoogle,
} from "@/features/auth/slice/accountSlice";
import {
    acceptInvite,
    registerUser,
    resendVerification,
    verifyEmail,
} from "@/features/auth/slice/registrationSlice";
import {
    logoutAllDevices,
    logoutUser,
    revokeSession,
} from "@/features/auth/slice/sessionsSlice";

export const SESSION_END = Object.freeze({
    LOGOUT: "LOGOUT",
    SESSION_EXPIRED: "SESSION_EXPIRED",
    SESSION_REVOKED: "SESSION_REVOKED",
    LOGOUT_OTHER_TAB: "LOGOUT_OTHER_TAB",
});

export const fetchCurrentUser = createAsyncThunk(
    "auth/fetchCurrentUser",
    async (options, { signal, rejectWithValue, getState }) => {
        try {
            const anonymous = getState().auth.user === null;
            const session = authApi.readSession(
                await authApi.getMe(
                    { boot: true, silent: anonymous },
                    { signal }
                )
            );
            if (!session) return rejectWithValue(authApi.invalidResponse());
            return { ...session, fetchedAt: Date.now() };
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    },
    {
        condition: (options, { getState }) => {
            const { auth } = getState();
            if (auth.status === STATUS.LOADING) return false;
            if (options?.force) return true;
            return !(auth.user && isFresh(auth.lastFetchedAt, TTL.me));
        },
    }
);

export const loginUser = createAsyncThunk(
    "auth/loginUser",
    async (body, { signal, rejectWithValue }) => {
        try {
            const session = authApi.readSession(
                await authApi.login(body, { signal })
            );
            return session
                ? { ...session, fetchedAt: Date.now() }
                : rejectWithValue(authApi.invalidResponse());
        } catch (error) {
            return rejectWithValue(toApiError(error), { at: Date.now() });
        }
    }
);

export const loginWithGoogle = createAsyncThunk(
    "auth/loginWithGoogle",
    async (body, { signal, rejectWithValue }) => {
        try {
            const session = authApi.readSession(
                await authApi.loginWithGoogle(body, { signal })
            );
            return session
                ? { ...session, fetchedAt: Date.now() }
                : rejectWithValue(authApi.invalidResponse());
        } catch (error) {
            return rejectWithValue(toApiError(error), { at: Date.now() });
        }
    }
);

const OP_THUNKS = [loginUser, loginWithGoogle, logoutUser, logoutAllDevices];
const SESSION_STARTERS = [
    verifyEmail,
    loginUser,
    loginWithGoogle,
    acceptInvite,
];

export const authInitialState = {
    user: null,
    bootstrapped: false,
    sessionEnd: null,
    limitedSession: false,
    pendingEmail: null,
    reactivated: false,
    onboardingSkipped: false,
    lockout: null,
    ...asyncInitial,
    ops: {},
};

function startSession(state, { payload }) {
    state.user = payload.user;
    state.bootstrapped = true;
    state.sessionEnd = null;
    state.limitedSession = false;
    state.pendingEmail = null;
    state.reactivated = payload.reactivate;
    state.lockout = null;
    state.status = STATUS.SUCCEEDED;
    state.error = null;
    state.lastFetchedAt = payload.fetchedAt;
}

function endSession(state, reason) {
    state.user = null;
    state.sessionEnd = reason;
    state.bootstrapped = true;
    state.limitedSession = false;
    state.reactivated = false;
    state.onboardingSkipped = false;
    state.lastFetchedAt = null;
}

function noteSignInFailure(state, { payload, meta }) {
    if (!payload) return;
    if (
        payload.code === API_ERROR_CODES.EMAIL_NOT_VERIFIED &&
        typeof meta.arg?.email === "string"
    )
        state.pendingEmail = meta.arg.email;
    if (
        payload.code === API_ERROR_CODES.ACCOUNT_LOCKED &&
        typeof payload.retryAfterSec === "number"
    ) {
        state.lockout = {
            until: (meta.at ?? 0) + payload.retryAfterSec * 1000,
        };
    }
}

function handleHydrationFailure(state, { payload, meta }) {
    if (meta.aborted || payload?.code === API_ERROR_CODES.REQUEST_CANCELED) {
        state.status = state.bootstrapped ? STATUS.SUCCEEDED : STATUS.IDLE;
        return;
    }
    state.bootstrapped =
        state.bootstrapped ||
        payload?.statusCode === 401 ||
        payload?.code === API_ERROR_CODES.MUST_CHANGE_PASSWORD;
    if (payload?.statusCode === 401) {
        if (state.user)
            state.sessionEnd =
                payload.code === API_ERROR_CODES.SESSION_REVOKED
                    ? SESSION_END.SESSION_REVOKED
                    : SESSION_END.SESSION_EXPIRED;
        state.user = null;
        state.status = STATUS.SUCCEEDED;
        state.error = null;
    } else if (payload?.code === API_ERROR_CODES.MUST_CHANGE_PASSWORD) {
        state.limitedSession = true;
        state.status = STATUS.SUCCEEDED;
        state.error = null;
    } else {
        state.status = STATUS.FAILED;
        state.error = payload ?? toApiError(undefined);
    }
}

const authSlice = createSlice({
    name: "auth",
    initialState: authInitialState,
    reducers: {
        sessionExpired: {
            reducer(state, { payload }) {
                endSession(state, payload.reason);
            },
            prepare(reason = SESSION_END.SESSION_EXPIRED) {
                const known = [
                    SESSION_END.SESSION_EXPIRED,
                    SESSION_END.SESSION_REVOKED,
                    SESSION_END.LOGOUT_OTHER_TAB,
                ];
                return {
                    payload: {
                        reason: known.includes(reason)
                            ? reason
                            : SESSION_END.SESSION_EXPIRED,
                    },
                };
            },
        },
        userPatched(state, { payload }) {
            if (state.user) state.user = { ...state.user, ...payload };
        },
        pendingEmailSet(state, { payload }) {
            state.pendingEmail =
                typeof payload === "string" && payload ? payload : null;
        },
        reactivationAcknowledged(state) {
            state.reactivated = false;
        },
        onboardingSkipped(state) {
            state.onboardingSkipped = true;
        },
        lockoutCleared(state) {
            state.lockout = null;
        },
        authOpCleared(state, { payload }) {
            delete state.ops[payload];
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchCurrentUser.pending, (state) => {
                state.status = STATUS.LOADING;
                state.error = null;
            })
            .addCase(fetchCurrentUser.fulfilled, (state, action) => {
                startSession(state, action);
                state.reactivated = false;
            })
            .addCase(fetchCurrentUser.rejected, handleHydrationFailure)
            .addCase(registerUser.fulfilled, (state, { meta }) => {
                state.pendingEmail =
                    typeof meta.arg?.email === "string" ? meta.arg.email : null;
            })
            .addCase(resendVerification.fulfilled, (state, { meta }) => {
                if (typeof meta.arg?.email === "string")
                    state.pendingEmail = meta.arg.email;
            })
            .addCase(loginUser.rejected, noteSignInFailure)
            .addCase(loginWithGoogle.rejected, noteSignInFailure)
            .addCase(logoutUser.fulfilled, (state) =>
                endSession(state, SESSION_END.LOGOUT)
            )
            .addCase(logoutAllDevices.fulfilled, (state) =>
                endSession(state, SESSION_END.LOGOUT)
            )
            .addCase(deleteAccount.fulfilled, (state) =>
                endSession(state, SESSION_END.LOGOUT)
            )
            .addCase(revokeSession.fulfilled, (state, { payload }) => {
                if (payload.wasCurrent) endSession(state, SESSION_END.LOGOUT);
            })
            .addCase(changePassword.fulfilled, (state, { payload }) => {
                const incoming = authApi.readSession(payload);
                state.limitedSession = false;
                if (incoming) state.user = { ...state.user, ...incoming.user };
                if (state.user) state.user.mustChangePassword = false;
            })
            .addCase(unlinkGoogle.fulfilled, (state, { payload }) => {
                const incoming = authApi.readSession(payload);
                if (incoming) state.user = { ...state.user, ...incoming.user };
                else if (state.user)
                    state.user.authProviders = (
                        state.user.authProviders ?? []
                    ).filter((provider) => provider !== "google");
            });
        for (const thunk of SESSION_STARTERS)
            builder.addCase(thunk.fulfilled, startSession);
        addOpMatchers(builder, OP_THUNKS);
    },
});

export const {
    sessionExpired,
    userPatched,
    pendingEmailSet,
    reactivationAcknowledged,
    onboardingSkipped,
    lockoutCleared,
    authOpCleared,
} = authSlice.actions;
export const authReducer = authSlice.reducer;

export const selectAuth = (state) => state.auth;
export const selectCurrentUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.user !== null;
export const selectIsBootstrapped = (state) => state.auth.bootstrapped;
export const selectAuthStatus = (state) => state.auth.status;
export const selectAuthError = (state) => state.auth.error;
export const selectSessionEnd = (state) => state.auth.sessionEnd;
export const selectLimitedSession = (state) => state.auth.limitedSession;
export const selectPendingEmail = (state) => state.auth.pendingEmail;
export const selectJustReactivated = (state) => state.auth.reactivated;
export const selectLockout = (state) => state.auth.lockout;
export const selectUserRole = (state) => state.auth.user?.role ?? null;
export const selectNeedsOnboarding = (state) =>
    Boolean(state.auth.user?.needsOnboarding) && !state.auth.onboardingSkipped;
export const selectMustChangePassword = (state) =>
    Boolean(state.auth.user?.mustChangePassword);
export const selectAuthOp = (state, name) => state.auth.ops[name] ?? opInitial;

/** One memoised object for route guards, so they re-render only when something they read changes. */
export const selectAuthGate = createSelector(
    [
        selectCurrentUser,
        selectIsBootstrapped,
        selectSessionEnd,
        selectLimitedSession,
        selectNeedsOnboarding,
        selectJustReactivated,
    ],
    (
        user,
        bootstrapped,
        sessionEnd,
        limitedSession,
        needsOnboarding,
        reactivated
    ) => ({
        user,
        bootstrapped,
        sessionEnd,
        limitedSession,
        needsOnboarding,
        reactivated,
        mustChangePassword: Boolean(user?.mustChangePassword),
    })
);
