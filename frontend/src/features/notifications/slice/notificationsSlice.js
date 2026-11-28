import {
    createAsyncThunk,
    createEntityAdapter,
    createSlice,
} from "@reduxjs/toolkit";
import * as notificationsApi from "@/features/notifications/api/notificationsApi";
import { queryKeyOf } from "@/features/notifications/schemas/notificationsSchemas";
import { API_ERROR_CODES, toApiError } from "@/lib/apiError";
import {
    STATUS,
    TTL,
    addOpMatchers,
    asyncInitial,
    isFresh,
} from "@/lib/asyncState";

/* In-app notifications of the signed-in user. Three independent reads share the slice: the paged list of the page (entity
   adapter, one server page at a time, FE-22), the five most recent shown by the bell, and the unread count the bell polls.
   Each read has its own `{ status, error, requestId }` so they never overwrite each other (FE-18, FE-25). Mutations update
   the list, the recent list and the count together, so the badge never disagrees with the rows. */

export const RECENT_LIMIT = 5;

const notificationsAdapter = createEntityAdapter();

const splitQuery = (arg) => {
    const { force = false, ...query } = arg ?? {};
    return { force, query, key: queryKeyOf(query) };
};

export const fetchNotifications = createAsyncThunk(
    "notifications/fetchNotifications",
    async (arg, { signal, rejectWithValue }) => {
        const { query, key } = splitQuery(arg);
        try {
            const { items, meta } = await notificationsApi.list(query, {
                signal,
            });
            return { items, meta, key, fetchedAt: Date.now() };
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    },
    {
        condition: (arg, { getState }) => {
            const { notifications } = getState();
            const { force, key } = splitQuery(arg);
            if (
                notifications.status === STATUS.LOADING &&
                notifications.queryKey === key
            )
                return false;
            if (force) return true;
            return !(
                notifications.loadedKey === key &&
                isFresh(notifications.lastFetchedAt, TTL.notifications)
            );
        },
    }
);

export const fetchRecentNotifications = createAsyncThunk(
    "notifications/fetchRecentNotifications",
    async (_arg, { signal, rejectWithValue }) => {
        try {
            const { items } = await notificationsApi.list(
                { page: 1, limit: RECENT_LIMIT },
                { signal }
            );
            return { items, fetchedAt: Date.now() };
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    },
    {
        condition: (_arg, { getState }) =>
            getState().notifications.recent.status !== STATUS.LOADING,
    }
);

export const fetchUnreadCount = createAsyncThunk(
    "notifications/fetchUnreadCount",
    async (_arg, { signal, rejectWithValue }) => {
        try {
            const count = await notificationsApi.getUnreadCount({ signal });
            return count === null
                ? rejectWithValue(notificationsApi.invalidResponse())
                : { count, fetchedAt: Date.now() };
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    },
    {
        condition: (_arg, { getState }) =>
            getState().notifications.unread.status !== STATUS.LOADING,
    }
);

export const markNotificationRead = createAsyncThunk(
    "notifications/markNotificationRead",
    async (id, { signal, rejectWithValue }) => {
        try {
            const notification = await notificationsApi.markRead(
                { id },
                { signal }
            );
            return (
                notification ??
                rejectWithValue(notificationsApi.invalidResponse())
            );
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

export const markAllNotificationsRead = createAsyncThunk(
    "notifications/markAllNotificationsRead",
    async (_arg, { signal, rejectWithValue }) => {
        try {
            const updated = await notificationsApi.markAllRead({ signal });
            // The time is taken here, not in the reducer, so reducers stay pure (FE-19).
            return { updated, at: new Date().toISOString() };
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

export const dismissNotification = createAsyncThunk(
    "notifications/dismissNotification",
    async (id, { signal, rejectWithValue }) => {
        try {
            return await notificationsApi.dismiss({ id }, { signal });
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

export const notificationsInitialState = notificationsAdapter.getInitialState({
    ...asyncInitial,
    queryKey: null,
    requestId: null,
    loadedKey: null,
    meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    recent: { ...asyncInitial, requestId: null, items: [] },
    unread: { ...asyncInitial, requestId: null, count: 0 },
    // Ids with a mark-read or dismiss in flight, so a row disables its own buttons and nothing else.
    pendingIds: [],
    ops: {},
});

const isCancelled = ({ payload, meta }) =>
    meta.aborted || payload?.code === API_ERROR_CODES.REQUEST_CANCELED;

const findKnown = (state, id) =>
    state.entities[id] ?? state.recent.items.find((item) => item.id === id);

const dropUnread = (state, id) => {
    const known = findKnown(state, id);
    if (known && !known.read)
        state.unread.count = Math.max(0, state.unread.count - 1);
};

const releasePending = (state, id) => {
    state.pendingIds = state.pendingIds.filter((pending) => pending !== id);
};

const notificationsSlice = createSlice({
    name: "notifications",
    initialState: notificationsInitialState,
    reducers: {
        notificationsOpCleared(state, { payload }) {
            delete state.ops[payload];
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchNotifications.pending, (state, { meta }) => {
                state.status = STATUS.LOADING;
                state.error = null;
                state.queryKey = splitQuery(meta.arg).key;
                state.requestId = meta.requestId;
            })
            .addCase(
                fetchNotifications.fulfilled,
                (state, { payload, meta }) => {
                    if (meta.requestId !== state.requestId) return;
                    notificationsAdapter.setAll(state, payload.items);
                    state.meta = payload.meta;
                    state.loadedKey = payload.key;
                    state.status = STATUS.SUCCEEDED;
                    state.lastFetchedAt = payload.fetchedAt;
                }
            )
            .addCase(fetchNotifications.rejected, (state, action) => {
                if (action.meta.requestId !== state.requestId) return;
                if (isCancelled(action)) {
                    state.status = STATUS.IDLE;
                    return;
                }
                state.status = STATUS.FAILED;
                state.error = action.payload ?? toApiError(action.error);
            })
            .addCase(fetchRecentNotifications.pending, (state, { meta }) => {
                state.recent.status = STATUS.LOADING;
                state.recent.error = null;
                state.recent.requestId = meta.requestId;
            })
            .addCase(
                fetchRecentNotifications.fulfilled,
                (state, { payload, meta }) => {
                    if (meta.requestId !== state.recent.requestId) return;
                    state.recent.items = payload.items;
                    state.recent.status = STATUS.SUCCEEDED;
                    state.recent.lastFetchedAt = payload.fetchedAt;
                }
            )
            .addCase(fetchRecentNotifications.rejected, (state, action) => {
                if (action.meta.requestId !== state.recent.requestId) return;
                if (isCancelled(action)) {
                    state.recent.status = STATUS.IDLE;
                    return;
                }
                state.recent.status = STATUS.FAILED;
                state.recent.error = action.payload ?? toApiError(action.error);
            })
            .addCase(fetchUnreadCount.pending, (state, { meta }) => {
                state.unread.status = STATUS.LOADING;
                state.unread.requestId = meta.requestId;
            })
            .addCase(fetchUnreadCount.fulfilled, (state, { payload, meta }) => {
                if (meta.requestId !== state.unread.requestId) return;
                state.unread.count = payload.count;
                state.unread.error = null;
                state.unread.status = STATUS.SUCCEEDED;
                state.unread.lastFetchedAt = payload.fetchedAt;
            })
            .addCase(fetchUnreadCount.rejected, (state, action) => {
                if (action.meta.requestId !== state.unread.requestId) return;
                if (isCancelled(action)) {
                    state.unread.status = STATUS.IDLE;
                    return;
                }
                // A failed poll keeps the last known count: the badge never flashes to zero because of a bad minute.
                state.unread.status = STATUS.FAILED;
                state.unread.error = action.payload ?? toApiError(action.error);
            })
            .addCase(markNotificationRead.pending, (state, { meta }) => {
                state.pendingIds.push(meta.arg);
            })
            .addCase(
                markNotificationRead.fulfilled,
                (state, { payload, meta }) => {
                    releasePending(state, meta.arg);
                    dropUnread(state, payload.id);
                    const changes = { read: true, readAt: payload.readAt };
                    notificationsAdapter.updateOne(state, {
                        id: payload.id,
                        changes,
                    });
                    state.recent.items = state.recent.items.map((item) =>
                        item.id === payload.id ? { ...item, ...changes } : item
                    );
                }
            )
            .addCase(markNotificationRead.rejected, (state, { meta }) => {
                releasePending(state, meta.arg);
            })
            .addCase(
                markAllNotificationsRead.fulfilled,
                (state, { payload }) => {
                    const changes = { read: true, readAt: payload.at };
                    for (const id of state.ids)
                        Object.assign(state.entities[id], changes);
                    state.recent.items = state.recent.items.map((item) =>
                        item.read ? item : { ...item, ...changes }
                    );
                    state.unread.count = 0;
                }
            )
            .addCase(dismissNotification.pending, (state, { meta }) => {
                state.pendingIds.push(meta.arg);
            })
            .addCase(
                dismissNotification.fulfilled,
                (state, { payload, meta }) => {
                    releasePending(state, meta.arg);
                    dropUnread(state, payload.id);
                    notificationsAdapter.removeOne(state, payload.id);
                    state.recent.items = state.recent.items.filter(
                        (item) => item.id !== payload.id
                    );
                    state.meta.total = Math.max(0, state.meta.total - 1);
                }
            )
            .addCase(dismissNotification.rejected, (state, { meta }) => {
                releasePending(state, meta.arg);
            });
        addOpMatchers(builder, [
            markNotificationRead,
            markAllNotificationsRead,
            dismissNotification,
        ]);
    },
});

export const { notificationsOpCleared } = notificationsSlice.actions;
export const notificationsReducer = notificationsSlice.reducer;

const listSelectors = notificationsAdapter.getSelectors(
    (state) => state.notifications
);
export const selectNotificationList = listSelectors.selectAll;
export const selectNotificationsStatus = (state) => state.notifications.status;
export const selectNotificationsError = (state) => state.notifications.error;
export const selectNotificationsMeta = (state) => state.notifications.meta;
export const selectRecentNotifications = (state) =>
    state.notifications.recent.items;
export const selectRecentStatus = (state) => state.notifications.recent.status;
export const selectRecentError = (state) => state.notifications.recent.error;
export const selectUnreadCount = (state) => state.notifications.unread.count;
export const selectPendingIds = (state) => state.notifications.pendingIds;
export const selectMarkAllReadStatus = (state) =>
    state.notifications.ops.markAllNotificationsRead?.status ?? STATUS.IDLE;
