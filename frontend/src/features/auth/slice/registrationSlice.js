import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { toApiError } from "@/lib/apiError";
import { addOpMatchers, asyncInitial, opInitial } from "@/lib/asyncState";
import * as authApi from "@/features/auth/api/authApi";

export const registerUser = createAsyncThunk(
    "registration/registerUser",
    async (body, { signal, rejectWithValue }) => {
        try {
            return await authApi.register(body, { signal });
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

/* Consumes the one-time token from the confirm screen; success starts a session (applied by the auth slice). */
export const verifyEmail = createAsyncThunk(
    "registration/verifyEmail",
    async (body, { signal, rejectWithValue }) => {
        try {
            const session = authApi.readSession(
                await authApi.verifyEmail(body, { signal })
            );
            return session
                ? { ...session, fetchedAt: Date.now() }
                : rejectWithValue(authApi.invalidResponse());
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

export const resendVerification = createAsyncThunk(
    "registration/resendVerification",
    async (body, { signal, rejectWithValue }) => {
        try {
            return await authApi.resendVerification(body, { signal });
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

export const acceptInvite = createAsyncThunk(
    "registration/acceptInvite",
    async (body, { signal, rejectWithValue }) => {
        try {
            const session = authApi.readSession(
                await authApi.acceptInvite(body, { signal })
            );
            return session
                ? { ...session, fetchedAt: Date.now() }
                : rejectWithValue(authApi.invalidResponse());
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

export const registrationInitialState = { ...asyncInitial, ops: {} };

const registrationSlice = createSlice({
    name: "registration",
    initialState: registrationInitialState,
    reducers: {
        registrationOpCleared(state, { payload }) {
            delete state.ops[payload];
        },
    },
    extraReducers: (builder) => {
        addOpMatchers(builder, [
            registerUser,
            verifyEmail,
            resendVerification,
            acceptInvite,
        ]);
    },
});

export const { registrationOpCleared } = registrationSlice.actions;
export const registrationReducer = registrationSlice.reducer;

export const selectRegistrationOp = (state, name) =>
    state.registration.ops[name] ?? opInitial;
