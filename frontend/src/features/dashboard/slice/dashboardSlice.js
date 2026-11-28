import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as dashboardApi from "@/features/dashboard/api/dashboardApi";
import { toApiError } from "@/lib/apiError";
import { STATUS, TTL, asyncInitial, isFresh } from "@/lib/asyncState";

/** Learner dashboard data: the gap analysis (required) and the planned learning hours (optional, a failure leaves it null). */
export const fetchDashboard = createAsyncThunk(
    "dashboard/fetchDashboard",
    async (_arg, { signal, rejectWithValue }) => {
        try {
            const [analysis, hours] = await Promise.all([
                dashboardApi.getGapAnalysis(undefined, { signal }),
                dashboardApi
                    .getPlannedHours({ signal })
                    .catch(() => null),
            ]);
            return { analysis, hours, fetchedAt: Date.now() };
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    },
    {
        condition: (arg, { getState }) => {
            const { dashboard } = getState();
            if (dashboard.status === STATUS.LOADING) return false;
            if (arg?.force) return true;
            return !isFresh(dashboard.lastFetchedAt, TTL.dashboard);
        },
    }
);

export const dashboardInitialState = {
    ...asyncInitial,
    analysis: null,
    hours: null,
};

const dashboardSlice = createSlice({
    name: "dashboard",
    initialState: dashboardInitialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchDashboard.pending, (state) => {
                state.status = STATUS.LOADING;
                state.error = null;
            })
            .addCase(fetchDashboard.fulfilled, (state, { payload }) => {
                state.status = STATUS.SUCCEEDED;
                state.analysis = payload.analysis;
                state.hours = payload.hours;
                state.lastFetchedAt = payload.fetchedAt;
            })
            .addCase(fetchDashboard.rejected, (state, action) => {
                if (action.meta.aborted) {
                    state.status = STATUS.IDLE;
                    return;
                }
                state.status = STATUS.FAILED;
                state.error = action.payload ?? toApiError(action.error);
            });
    },
});

export const dashboardReducer = dashboardSlice.reducer;
export const selectDashboard = (state) => state.dashboard;

/** Top gaps still open, biggest first. Pure: call it inside `useMemo`, not inside a selector. */
export const topGaps = (analysis, limit = 5) =>
    (analysis?.gaps ?? [])
        .filter((gap) => gap.gapDelta > 0)
        .sort((a, b) => b.gapDelta - a.gapDelta)
        .slice(0, limit);
