import {
    createAsyncThunk,
    createEntityAdapter,
    createSlice,
} from "@reduxjs/toolkit";
import { API_ERROR_CODES, toApiError } from "@/lib/apiError";
import {
    STATUS,
    TTL,
    addOpMatchers,
    asyncInitial,
    isFresh,
    opInitial,
} from "@/lib/asyncState";
import * as adminApi from "@/features/admin/api/adminApi";
import { queryKeyOf } from "@/features/admin/schemas/adminSchemas";

/* Invitations in the signed-in admin scope (R69). The list is one server page: the URL owns page, limit and filter (FE-26); the
   slice keeps the page that was read last, the query it answers and a record per operation (create, revoke, resend). */

const invitesAdapter = createEntityAdapter();

const splitQuery = (arg) => {
    const { force = false, ...query } = arg ?? {};
    return { force, query, key: queryKeyOf(query) };
};

export const fetchInvites = createAsyncThunk(
    "invites/fetchInvites",
    async (arg, { signal, rejectWithValue }) => {
        const { query, key } = splitQuery(arg);
        try {
            const { items, meta } = await adminApi.listInvites(query, {
                signal,
            });
            return { items, meta, key, fetchedAt: Date.now() };
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    },
    {
        condition: (arg, { getState }) => {
            const { invites } = getState();
            const { force, key } = splitQuery(arg);
            if (invites.status === STATUS.LOADING && invites.queryKey === key)
                return false;
            if (force) return true;
            return !(
                invites.loadedKey === key &&
                isFresh(invites.lastFetchedAt, TTL.adminList)
            );
        },
    }
);

export const createInvite = createAsyncThunk(
    "invites/createInvite",
    async (body, { signal, rejectWithValue }) => {
        try {
            const invite = await adminApi.createInvite(body, { signal });
            return invite ?? rejectWithValue(adminApi.invalidResponse());
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

export const revokeInvite = createAsyncThunk(
    "invites/revokeInvite",
    async (args, { signal, rejectWithValue }) => {
        try {
            const invite = await adminApi.revokeInvite(args, { signal });
            return invite ?? rejectWithValue(adminApi.invalidResponse());
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

export const resendInvite = createAsyncThunk(
    "invites/resendInvite",
    async (args, { signal, rejectWithValue }) => {
        try {
            const invite = await adminApi.resendInvite(args, { signal });
            return invite ?? rejectWithValue(adminApi.invalidResponse());
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

export const invitesInitialState = invitesAdapter.getInitialState({
    ...asyncInitial,
    queryKey: null,
    requestId: null,
    loadedKey: null,
    meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    ops: {},
});

const isCancelled = ({ payload, meta }) =>
    meta.aborted || payload?.code === API_ERROR_CODES.REQUEST_CANCELED;

const invitesSlice = createSlice({
    name: "invites",
    initialState: invitesInitialState,
    reducers: {
        invitesOpCleared(state, { payload }) {
            delete state.ops[payload];
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchInvites.pending, (state, { meta }) => {
                state.status = STATUS.LOADING;
                state.error = null;
                state.queryKey = splitQuery(meta.arg).key;
                state.requestId = meta.requestId;
            })
            .addCase(fetchInvites.fulfilled, (state, { payload, meta }) => {
                if (meta.requestId !== state.requestId) return;
                invitesAdapter.setAll(state, payload.items);
                state.meta = payload.meta;
                state.loadedKey = payload.key;
                state.status = STATUS.SUCCEEDED;
                state.lastFetchedAt = payload.fetchedAt;
            })
            .addCase(fetchInvites.rejected, (state, action) => {
                if (action.meta.requestId !== state.requestId) return;
                if (isCancelled(action)) {
                    state.status = state.loadedKey
                        ? STATUS.SUCCEEDED
                        : STATUS.IDLE;
                    return;
                }
                state.status = STATUS.FAILED;
                state.error = action.payload ?? toApiError(undefined);
            })
            .addCase(createInvite.fulfilled, (state) => {
                state.lastFetchedAt = null;
            })
            .addCase(revokeInvite.fulfilled, (state, { payload }) => {
                invitesAdapter.upsertOne(state, payload);
            })
            .addCase(resendInvite.fulfilled, (state, { payload }) => {
                invitesAdapter.upsertOne(state, payload);
            });
        addOpMatchers(builder, [createInvite, revokeInvite, resendInvite]);
    },
});

export const { invitesOpCleared } = invitesSlice.actions;
export const invitesReducer = invitesSlice.reducer;

export const { selectAll: selectAllInvites, selectById: selectInviteById } =
    invitesAdapter.getSelectors((state) => state.invites);
export const selectInvitesStatus = (state) => state.invites.status;
export const selectInvitesError = (state) => state.invites.error;
export const selectInvitesMeta = (state) => state.invites.meta;
export const selectInvitesLoadedKey = (state) => state.invites.loadedKey;
export const selectInvitesOp = (state, name) =>
    state.invites.ops[name] ?? opInitial;
