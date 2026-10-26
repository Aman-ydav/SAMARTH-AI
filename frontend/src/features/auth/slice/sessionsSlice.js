import {
    createAsyncThunk,
    createEntityAdapter,
    createSelector,
    createSlice,
    isAnyOf,
} from "@reduxjs/toolkit";
import { API_ERROR_CODES, toApiError } from "@/lib/apiError";
import { STATUS, asyncInitial, opInitial } from "@/lib/asyncState";
import * as authApi from "@/features/auth/api/authApi";

const sessionsAdapter = createEntityAdapter({
    sortComparer: (a, b) =>
        String(b.lastUsedAt ?? "").localeCompare(String(a.lastUsedAt ?? "")),
});

/** Defensive shape for one device session (FE-37). */
function readSessions(items) {
    return (Array.isArray(items) ? items : [])
        .filter((item) => item && typeof item.id === "string")
        .map((item) => ({
            id: item.id,
            device: typeof item.device === "string" ? item.device : "",
            createdAt: item.createdAt ?? null,
            lastUsedAt: item.lastUsedAt ?? null,
            current: item.current === true,
        }));
}

export const fetchSessions = createAsyncThunk(
    "sessions/fetchSessions",
    async (options, { signal, rejectWithValue }) => {
        try {
            return {
                items: readSessions(await authApi.listSessions({ signal })),
                fetchedAt: Date.now(),
            };
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    },
    {
        condition: (options, { getState }) =>
            getState().sessions.status !== STATUS.LOADING,
    }
);

export const revokeSession = createAsyncThunk(
    "sessions/revokeSession",
    async (args, { signal, rejectWithValue, getState }) => {
        try {
            const wasCurrent =
                getState().sessions.entities[args.id]?.current === true;
            await authApi.revokeSession({ id: args.id }, { signal });
            return { id: args.id, wasCurrent };
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

/* The API has no bulk endpoint, so "sign out other devices" revokes the other sessions one by one (at most 10 exist). It stops at the first failure and reports it; the UI then reloads the list to show what really ended. */
export const revokeOtherSessions = createAsyncThunk(
    "sessions/revokeOtherSessions",
    async (options, { signal, rejectWithValue, getState }) => {
        const ids = selectOtherSessions(getState()).map(
            (session) => session.id
        );
        try {
            for (const id of ids)
                await authApi.revokeSession({ id }, { signal });
            return { ids };
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

/* Logout is honest (FE-59): success or a 401 ends the session; network or 5xx failures keep the user signed in. */
export const logoutUser = createAsyncThunk(
    "sessions/logoutUser",
    async (options, { signal, rejectWithValue }) => {
        try {
            await authApi.logout({ signal });
            return { alreadyEnded: false };
        } catch (error) {
            if (toApiError(error).statusCode === 401)
                return { alreadyEnded: true };
            return rejectWithValue(toApiError(error));
        }
    }
);

export const logoutAllDevices = createAsyncThunk(
    "sessions/logoutAllDevices",
    async (options, { signal, rejectWithValue }) => {
        try {
            await authApi.logoutAll({ signal });
            return { alreadyEnded: false };
        } catch (error) {
            if (toApiError(error).statusCode === 401)
                return { alreadyEnded: true };
            return rejectWithValue(toApiError(error));
        }
    }
);

const REVOKE_PENDING = isAnyOf(
    revokeSession.pending,
    revokeOtherSessions.pending
);
const REVOKE_FULFILLED = isAnyOf(
    revokeSession.fulfilled,
    revokeOtherSessions.fulfilled
);
const REVOKE_REJECTED = isAnyOf(
    revokeSession.rejected,
    revokeOtherSessions.rejected
);

const sessionsSlice = createSlice({
    name: "sessions",
    initialState: sessionsAdapter.getInitialState({
        ...asyncInitial,
        revoke: { ...opInitial },
    }),
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchSessions.pending, (state) => {
                state.status = STATUS.LOADING;
                state.error = null;
            })
            .addCase(fetchSessions.fulfilled, (state, { payload }) => {
                sessionsAdapter.setAll(state, payload.items);
                state.status = STATUS.SUCCEEDED;
                state.lastFetchedAt = payload.fetchedAt;
            })
            .addCase(fetchSessions.rejected, (state, { payload, meta }) => {
                const cancelled =
                    meta.aborted ||
                    payload?.code === API_ERROR_CODES.REQUEST_CANCELED;
                state.status = cancelled ? STATUS.IDLE : STATUS.FAILED;
                state.error = cancelled
                    ? null
                    : (payload ?? toApiError(undefined));
            })
            .addCase(revokeSession.fulfilled, (state, { payload }) => {
                sessionsAdapter.removeOne(state, payload.id);
            })
            .addCase(revokeOtherSessions.fulfilled, (state, { payload }) => {
                sessionsAdapter.removeMany(state, payload.ids);
            })
            .addMatcher(REVOKE_PENDING, (state) => {
                state.revoke = { status: STATUS.LOADING, error: null };
            })
            .addMatcher(REVOKE_FULFILLED, (state) => {
                state.revoke = { status: STATUS.SUCCEEDED, error: null };
            })
            .addMatcher(REVOKE_REJECTED, (state, { payload }) => {
                state.revoke = {
                    status: STATUS.FAILED,
                    error: payload ?? toApiError(undefined),
                };
            });
    },
});

export const sessionsReducer = sessionsSlice.reducer;

export const { selectAll: selectAllSessions, selectById: selectSessionById } =
    sessionsAdapter.getSelectors((state) => state.sessions);
export const selectSessionsStatus = (state) => state.sessions.status;
export const selectSessionsError = (state) => state.sessions.error;
export const selectRevokeSessionOp = (state) => state.sessions.revoke;
export const selectOtherSessions = createSelector(
    [selectAllSessions],
    (sessions) => sessions.filter((session) => !session.current)
);
