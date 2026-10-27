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

/* The accounts an admin may see (R69) as one server page, plus a record per operation (status and role changes). It is named
   `adminUsers` so it never collides with the signed-in person held by the `auth` slice. */

const usersAdapter = createEntityAdapter();

const splitQuery = (arg) => {
    const { force = false, ...query } = arg ?? {};
    return { force, query, key: queryKeyOf(query) };
};

export const fetchAdminUsers = createAsyncThunk(
    "adminUsers/fetchAdminUsers",
    async (arg, { signal, rejectWithValue }) => {
        const { query, key } = splitQuery(arg);
        try {
            const { items, meta } = await adminApi.listUsers(query, { signal });
            return { items, meta, key, fetchedAt: Date.now() };
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    },
    {
        condition: (arg, { getState }) => {
            const { adminUsers } = getState();
            const { force, key } = splitQuery(arg);
            if (
                adminUsers.status === STATUS.LOADING &&
                adminUsers.queryKey === key
            )
                return false;
            if (force) return true;
            return !(
                adminUsers.loadedKey === key &&
                isFresh(adminUsers.lastFetchedAt, TTL.adminList)
            );
        },
    }
);

export const updateUserStatus = createAsyncThunk(
    "adminUsers/updateUserStatus",
    async (args, { signal, rejectWithValue }) => {
        try {
            const user = await adminApi.setUserStatus(args, { signal });
            return user ?? rejectWithValue(adminApi.invalidResponse());
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

export const updateUserRole = createAsyncThunk(
    "adminUsers/updateUserRole",
    async (args, { signal, rejectWithValue }) => {
        try {
            const user = await adminApi.changeUserRole(args, { signal });
            return user ?? rejectWithValue(adminApi.invalidResponse());
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

export const adminUsersInitialState = usersAdapter.getInitialState({
    ...asyncInitial,
    queryKey: null,
    requestId: null,
    loadedKey: null,
    meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    ops: {},
});

const isCancelled = ({ payload, meta }) =>
    meta.aborted || payload?.code === API_ERROR_CODES.REQUEST_CANCELED;

const adminUsersSlice = createSlice({
    name: "adminUsers",
    initialState: adminUsersInitialState,
    reducers: {
        adminUsersOpCleared(state, { payload }) {
            delete state.ops[payload];
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchAdminUsers.pending, (state, { meta }) => {
                state.status = STATUS.LOADING;
                state.error = null;
                state.queryKey = splitQuery(meta.arg).key;
                state.requestId = meta.requestId;
            })
            .addCase(fetchAdminUsers.fulfilled, (state, { payload, meta }) => {
                if (meta.requestId !== state.requestId) return;
                usersAdapter.setAll(state, payload.items);
                state.meta = payload.meta;
                state.loadedKey = payload.key;
                state.status = STATUS.SUCCEEDED;
                state.lastFetchedAt = payload.fetchedAt;
            })
            .addCase(fetchAdminUsers.rejected, (state, action) => {
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
            .addCase(updateUserStatus.fulfilled, (state, { payload }) => {
                usersAdapter.upsertOne(state, payload);
            })
            .addCase(updateUserRole.fulfilled, (state, { payload }) => {
                usersAdapter.upsertOne(state, payload);
            });
        addOpMatchers(builder, [updateUserStatus, updateUserRole]);
    },
});

export const { adminUsersOpCleared } = adminUsersSlice.actions;
export const adminUsersReducer = adminUsersSlice.reducer;

export const {
    selectAll: selectAllAdminUsers,
    selectById: selectAdminUserById,
} = usersAdapter.getSelectors((state) => state.adminUsers);
export const selectAdminUsersStatus = (state) => state.adminUsers.status;
export const selectAdminUsersError = (state) => state.adminUsers.error;
export const selectAdminUsersMeta = (state) => state.adminUsers.meta;
export const selectAdminUsersLoadedKey = (state) => state.adminUsers.loadedKey;
export const selectAdminUsersOp = (state, name) =>
    state.adminUsers.ops[name] ?? opInitial;
