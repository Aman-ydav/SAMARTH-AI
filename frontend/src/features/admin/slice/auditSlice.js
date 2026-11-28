import {
    createAsyncThunk,
    createEntityAdapter,
    createSlice,
} from "@reduxjs/toolkit";
import { invalidResponse } from "@/features/admin/api/adminApi";
import * as auditApi from "@/features/admin/api/auditApi";
import { queryKeyOf } from "@/features/admin/schemas/adminSchemas";
import { API_ERROR_CODES, toApiError } from "@/lib/apiError";
import { STATUS, TTL, asyncInitial, isFresh } from "@/lib/asyncState";

/* The audit trail screen (doc 08 section 6.4). Three independent operations share the slice, each with its own
   `{ status, error }` (FE-18): the paged entry list (entity adapter, one server page at a time, FE-22), the result of the real
   chain check, and the result of the tamper simulation. The check and the simulation are platform-admin only; the server
   answers 403 to anyone else, the screen just never offers them. */

const entriesAdapter = createEntityAdapter();

const splitQuery = (arg) => {
    const { force = false, ...query } = arg ?? {};
    return { force, query, key: queryKeyOf(query) };
};

export const fetchAuditEntries = createAsyncThunk(
    "audit/fetchAuditEntries",
    async (arg, { signal, rejectWithValue }) => {
        const { query, key } = splitQuery(arg);
        try {
            const { items, meta } = await auditApi.listEntries(query, {
                signal,
            });
            return { items, meta, key, fetchedAt: Date.now() };
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    },
    {
        condition: (arg, { getState }) => {
            const { audit } = getState();
            const { force, key } = splitQuery(arg);
            if (audit.status === STATUS.LOADING && audit.queryKey === key)
                return false;
            if (force) return true;
            return !(
                audit.loadedKey === key &&
                isFresh(audit.lastFetchedAt, TTL.adminList)
            );
        },
    }
);

export const fetchChainStatus = createAsyncThunk(
    "audit/fetchChainStatus",
    async (_arg, { signal, rejectWithValue }) => {
        try {
            const data = await auditApi.verifyChain({ signal });
            return data
                ? { data, fetchedAt: Date.now() }
                : rejectWithValue(invalidResponse());
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    },
    {
        condition: (arg, { getState }) => {
            const { chain } = getState().audit;
            if (chain.status === STATUS.LOADING) return false;
            if (arg?.force) return true;
            return !(chain.data && isFresh(chain.lastFetchedAt, TTL.dashboard));
        },
    }
);

export const simulateTamper = createAsyncThunk(
    "audit/simulateTamper",
    async (seq, { signal, rejectWithValue }) => {
        try {
            const result = await auditApi.simulateTamper({ seq }, { signal });
            return result ?? rejectWithValue(invalidResponse());
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    },
    {
        // One simulation at a time: a double click sends one request (EDGE-30).
        condition: (_seq, { getState }) =>
            getState().audit.simulation.status !== STATUS.LOADING,
    }
);

export const auditInitialState = entriesAdapter.getInitialState({
    ...asyncInitial,
    queryKey: null,
    requestId: null,
    loadedKey: null,
    meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    chain: { ...asyncInitial, requestId: null, data: null },
    simulation: { status: STATUS.IDLE, error: null, result: null },
});

const isCancelled = ({ payload, meta }) =>
    meta.aborted || payload?.code === API_ERROR_CODES.REQUEST_CANCELED;

const auditSlice = createSlice({
    name: "audit",
    initialState: auditInitialState,
    reducers: {
        auditSimulationCleared(state) {
            state.simulation = {
                status: STATUS.IDLE,
                error: null,
                result: null,
            };
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchAuditEntries.pending, (state, { meta }) => {
                state.status = STATUS.LOADING;
                state.error = null;
                state.queryKey = splitQuery(meta.arg).key;
                state.requestId = meta.requestId;
            })
            .addCase(
                fetchAuditEntries.fulfilled,
                (state, { payload, meta }) => {
                    if (meta.requestId !== state.requestId) return;
                    entriesAdapter.setAll(state, payload.items);
                    state.meta = payload.meta;
                    state.loadedKey = payload.key;
                    state.status = STATUS.SUCCEEDED;
                    state.lastFetchedAt = payload.fetchedAt;
                }
            )
            .addCase(fetchAuditEntries.rejected, (state, action) => {
                if (action.meta.requestId !== state.requestId) return;
                if (isCancelled(action)) {
                    state.status = STATUS.IDLE;
                    return;
                }
                state.status = STATUS.FAILED;
                state.error = action.payload ?? toApiError(action.error);
            })
            .addCase(fetchChainStatus.pending, (state, { meta }) => {
                state.chain.status = STATUS.LOADING;
                state.chain.error = null;
                state.chain.requestId = meta.requestId;
            })
            .addCase(fetchChainStatus.fulfilled, (state, { payload, meta }) => {
                if (meta.requestId !== state.chain.requestId) return;
                state.chain.data = payload.data;
                state.chain.status = STATUS.SUCCEEDED;
                state.chain.lastFetchedAt = payload.fetchedAt;
            })
            .addCase(fetchChainStatus.rejected, (state, action) => {
                if (action.meta.requestId !== state.chain.requestId) return;
                if (isCancelled(action)) {
                    state.chain.status = STATUS.IDLE;
                    return;
                }
                // The last result stays on screen next to the error (revalidation never blanks the view).
                state.chain.status = STATUS.FAILED;
                state.chain.error = action.payload ?? toApiError(action.error);
            })
            .addCase(simulateTamper.pending, (state) => {
                state.simulation = {
                    status: STATUS.LOADING,
                    error: null,
                    result: null,
                };
            })
            .addCase(simulateTamper.fulfilled, (state, { payload }) => {
                state.simulation = {
                    status: STATUS.SUCCEEDED,
                    error: null,
                    result: payload,
                };
            })
            .addCase(simulateTamper.rejected, (state, action) => {
                state.simulation = isCancelled(action)
                    ? { status: STATUS.IDLE, error: null, result: null }
                    : {
                          status: STATUS.FAILED,
                          error: action.payload ?? toApiError(action.error),
                          result: null,
                      };
            });
    },
});

export const { auditSimulationCleared } = auditSlice.actions;
export const auditReducer = auditSlice.reducer;

const entrySelectors = entriesAdapter.getSelectors((state) => state.audit);
export const selectAuditEntries = entrySelectors.selectAll;
export const selectAuditStatus = (state) => state.audit.status;
export const selectAuditError = (state) => state.audit.error;
export const selectAuditMeta = (state) => state.audit.meta;
export const selectAuditLoadedKey = (state) => state.audit.loadedKey;
export const selectChain = (state) => state.audit.chain;
export const selectSimulation = (state) => state.audit.simulation;
