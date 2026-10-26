import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { API_ERROR_CODES, toApiError } from "@/lib/apiError";
import {
    STATUS,
    TTL,
    addOpMatchers,
    asyncInitial,
    isFresh,
    opInitial,
} from "@/lib/asyncState";
import { invalidResponse } from "@/features/auth/api/authApi";
import * as profileApi from "@/features/auth/api/profileApi";

/* The editable profile (name, language, time zone) lives in the `auth` user and here; this slice keeps what `/auth/me` lacks
   (the time zone) and the avatar upload progress. The `auth` slice listens to these thunks to keep its user summary current. */

export const fetchProfile = createAsyncThunk(
    "profile/fetchProfile",
    async (options, { signal, rejectWithValue }) => {
        try {
            const profile = profileApi.readProfileUser(
                await profileApi.getProfile({ signal })
            );
            if (!profile) return rejectWithValue(invalidResponse());
            return { ...profile, fetchedAt: Date.now() };
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    },
    {
        condition: (options, { getState }) => {
            const { profile } = getState();
            if (profile.status === STATUS.LOADING) return false;
            if (options?.force) return true;
            return !(
                profile.timezone !== null &&
                isFresh(profile.lastFetchedAt, TTL.me)
            );
        },
    }
);

export const updateProfile = createAsyncThunk(
    "profile/updateProfile",
    async (body, { signal, rejectWithValue }) => {
        try {
            const profile = profileApi.readProfileUser(
                await profileApi.updateProfile(body, { signal })
            );
            return profile ?? rejectWithValue(invalidResponse());
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

/** The `File` is a thunk argument only: RTK skips `meta.arg` in its serialisability check and it never reaches state or payloads. */
export const uploadAvatar = createAsyncThunk(
    "profile/uploadAvatar",
    async ({ file }, { signal, dispatch, rejectWithValue }) => {
        let last = -1;
        const onProgress = (percent) => {
            if (percent === last) return;
            last = percent;
            dispatch(avatarProgressed(percent));
        };
        try {
            const profile = profileApi.readProfileUser(
                await profileApi.uploadAvatar({ file }, { signal, onProgress })
            );
            return profile ?? rejectWithValue(invalidResponse());
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

export const removeAvatar = createAsyncThunk(
    "profile/removeAvatar",
    async (options, { signal, rejectWithValue }) => {
        try {
            const profile = profileApi.readProfileUser(
                await profileApi.removeAvatar({ signal })
            );
            return profile ?? rejectWithValue(invalidResponse());
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

const OP_THUNKS = [updateProfile, uploadAvatar, removeAvatar];

export const profileInitialState = {
    timezone: null,
    avatarProgress: 0,
    ...asyncInitial,
    ops: {},
};

const profileSlice = createSlice({
    name: "profile",
    initialState: profileInitialState,
    reducers: {
        avatarProgressed(state, { payload }) {
            state.avatarProgress = Math.min(100, Math.max(0, payload));
        },
        profileOpCleared(state, { payload }) {
            delete state.ops[payload];
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchProfile.pending, (state) => {
                state.status = STATUS.LOADING;
                state.error = null;
            })
            .addCase(fetchProfile.fulfilled, (state, { payload }) => {
                state.timezone = payload.timezone;
                state.status = STATUS.SUCCEEDED;
                state.lastFetchedAt = payload.fetchedAt;
            })
            .addCase(fetchProfile.rejected, (state, { payload, meta }) => {
                const cancelled =
                    meta.aborted ||
                    payload?.code === API_ERROR_CODES.REQUEST_CANCELED;
                state.status = cancelled ? STATUS.IDLE : STATUS.FAILED;
                state.error = cancelled
                    ? null
                    : (payload ?? toApiError(undefined));
            })
            .addCase(updateProfile.fulfilled, (state, { payload }) => {
                if (payload.timezone) state.timezone = payload.timezone;
            })
            .addCase(uploadAvatar.pending, (state) => {
                state.avatarProgress = 0;
            })
            .addCase(uploadAvatar.fulfilled, (state) => {
                state.avatarProgress = 100;
            })
            .addCase(uploadAvatar.rejected, (state) => {
                state.avatarProgress = 0;
            });
        addOpMatchers(builder, OP_THUNKS);
    },
});

export const { avatarProgressed, profileOpCleared } = profileSlice.actions;
export const profileReducer = profileSlice.reducer;

export const selectProfileTimezone = (state) => state.profile.timezone;
export const selectProfileStatus = (state) => state.profile.status;
export const selectProfileError = (state) => state.profile.error;
export const selectAvatarProgress = (state) => state.profile.avatarProgress;
export const selectProfileOp = (state, name) =>
    state.profile.ops[name] ?? opInitial;
