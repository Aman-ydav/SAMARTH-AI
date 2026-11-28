import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { userPatched } from "@/features/auth";
import * as competenciesApi from "@/features/competencies";
import * as onboardingApi from "@/features/onboarding/api/onboardingApi";
import {
    toProfilePayload,
    toRatingsPayload,
} from "@/features/onboarding/schemas/onboardingSchemas";
import { toApiError } from "@/lib/apiError";
import { STATUS } from "@/lib/asyncState";

const op = () => ({ status: STATUS.IDLE, error: null });
const failure = (action) => action.payload ?? toApiError(action.error);
const cancelled = (action) => Boolean(action.meta.aborted);

export const fetchFramework = createAsyncThunk(
    "onboarding/fetchFramework",
    async (_arg, { signal, rejectWithValue }) => {
        try {
            return await competenciesApi.getFramework({ signal });
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    },
    {
        condition: (_arg, { getState }) =>
            getState().onboarding.framework.status !== STATUS.LOADING,
    }
);

export const fetchRoles = createAsyncThunk(
    "onboarding/fetchRoles",
    async (_arg, { signal, rejectWithValue }) => {
        try {
            return await competenciesApi.getRoles({ signal });
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    },
    {
        condition: (_arg, { getState }) =>
            getState().onboarding.roles.status !== STATUS.LOADING,
    }
);

/** Saves the profile, then the self-assessment. Single-flight: a second dispatch while one runs is dropped. */
export const submitOnboarding = createAsyncThunk(
    "onboarding/submitOnboarding",
    async (_arg, { getState, dispatch, signal, rejectWithValue }) => {
        const { profile, ratings } = getState().onboarding;
        try {
            const user = await onboardingApi.saveOnboardingProfile(
                toProfilePayload(profile),
                { signal }
            );
            await competenciesApi.saveSelfAssessment(
                toRatingsPayload(ratings),
                { signal }
            );
            dispatch(
                userPatched({
                    needsOnboarding: false,
                    onboardingCompletedAt:
                        user?.onboardingCompletedAt ?? new Date().toISOString(),
                })
            );
            return true;
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    },
    {
        condition: (_arg, { getState }) =>
            getState().onboarding.submit.status !== STATUS.LOADING,
    }
);

export const onboardingInitialState = {
    step: 1,
    profile: {
        designation: "",
        department: "",
        yearsOfService: "",
        targetRole: "",
    },
    ratings: {},
    framework: { ...op(), items: [] },
    roles: { ...op(), items: [] },
    submit: op(),
};

const listOps = [
    [fetchFramework, "framework"],
    [fetchRoles, "roles"],
];

const onboardingSlice = createSlice({
    name: "onboarding",
    initialState: onboardingInitialState,
    reducers: {
        profileSaved(state, { payload }) {
            state.profile = { ...state.profile, ...payload };
        },
        ratingSet(state, { payload: { competencyId, level } }) {
            state.ratings[competencyId] = level;
        },
        stepChanged(state, { payload }) {
            state.step = Math.min(3, Math.max(1, payload));
        },
        onboardingReset: () => onboardingInitialState,
    },
    extraReducers: (builder) => {
        for (const [thunk, key] of listOps) {
            builder
                .addCase(thunk.pending, (state) => {
                    state[key].status = STATUS.LOADING;
                    state[key].error = null;
                })
                .addCase(thunk.fulfilled, (state, { payload }) => {
                    state[key] = {
                        status: STATUS.SUCCEEDED,
                        error: null,
                        items: payload,
                    };
                })
                .addCase(thunk.rejected, (state, action) => {
                    if (cancelled(action)) return;
                    state[key].status = STATUS.FAILED;
                    state[key].error = failure(action);
                });
        }
        builder
            .addCase(submitOnboarding.pending, (state) => {
                state.submit = { status: STATUS.LOADING, error: null };
            })
            .addCase(submitOnboarding.fulfilled, (state) => {
                state.submit = { status: STATUS.SUCCEEDED, error: null };
            })
            .addCase(submitOnboarding.rejected, (state, action) => {
                state.submit = cancelled(action)
                    ? op()
                    : { status: STATUS.FAILED, error: failure(action) };
            });
    },
});

export const { profileSaved, ratingSet, stepChanged, onboardingReset } =
    onboardingSlice.actions;
export const onboardingReducer = onboardingSlice.reducer;

export const selectOnboarding = (state) => state.onboarding;
