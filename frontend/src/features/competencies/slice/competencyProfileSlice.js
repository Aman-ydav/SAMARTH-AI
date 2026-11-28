import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as profileApi from "@/features/competencies/api/competencyProfileApi";
import { toApiError } from "@/lib/apiError";
import { STATUS, TTL, asyncInitial, isFresh } from "@/lib/asyncState";

export const fetchCompetencyProfile = createAsyncThunk(
    "competencyProfile/fetch",
    async (_arg, { signal, rejectWithValue }) => {
        try {
            const items = await profileApi.getMyCompetencies({ signal });
            return { items, fetchedAt: Date.now() };
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    },
    {
        condition: (arg, { getState }) => {
            const { competencyProfile } = getState();
            if (competencyProfile.status === STATUS.LOADING) return false;
            if (arg?.force) return true;
            return !isFresh(competencyProfile.lastFetchedAt, TTL.me);
        },
    }
);

export const competencyProfileInitialState = { ...asyncInitial, items: [] };

const competencyProfileSlice = createSlice({
    name: "competencyProfile",
    initialState: competencyProfileInitialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchCompetencyProfile.pending, (state) => {
                state.status = STATUS.LOADING;
                state.error = null;
            })
            .addCase(fetchCompetencyProfile.fulfilled, (state, { payload }) => {
                state.status = STATUS.SUCCEEDED;
                state.items = payload.items;
                state.lastFetchedAt = payload.fetchedAt;
            })
            .addCase(fetchCompetencyProfile.rejected, (state, action) => {
                if (action.meta.aborted) {
                    state.status = STATUS.IDLE;
                    return;
                }
                state.status = STATUS.FAILED;
                state.error = action.payload ?? toApiError(action.error);
            });
    },
});

export const competencyProfileReducer = competencyProfileSlice.reducer;
export const selectCompetencyProfile = (state) => state.competencyProfile;

/** Distinct domains in first-seen order. Pure: call inside `useMemo`. */
export const domainsOf = (items) => [
    ...new Set(items.map((item) => item.domain).filter(Boolean)),
];
