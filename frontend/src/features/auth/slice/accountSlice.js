import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { toApiError } from "@/lib/apiError";
import { addOpMatchers, asyncInitial, opInitial } from "@/lib/asyncState";
import * as authApi from "@/features/auth/api/authApi";

export const forgotPassword = createAsyncThunk(
    "account/forgotPassword",
    async (body, { signal, rejectWithValue }) => {
        try {
            return await authApi.forgotPassword(body, { signal });
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

export const validateResetToken = createAsyncThunk(
    "account/validateResetToken",
    async (body, { signal, rejectWithValue }) => {
        try {
            return await authApi.validateResetToken(body, { signal });
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

export const resetPassword = createAsyncThunk(
    "account/resetPassword",
    async (body, { signal, rejectWithValue }) => {
        try {
            return await authApi.resetPassword(body, { signal });
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

export const changePassword = createAsyncThunk(
    "account/changePassword",
    async (body, { signal, rejectWithValue }) => {
        try {
            return await authApi.changePassword(body, { signal });
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

export const changeEmail = createAsyncThunk(
    "account/changeEmail",
    async (body, { signal, rejectWithValue }) => {
        try {
            return await authApi.changeEmail(body, { signal });
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

export const confirmEmailChange = createAsyncThunk(
    "account/confirmEmailChange",
    async (body, { signal, rejectWithValue }) => {
        try {
            return await authApi.confirmEmailChange(body, { signal });
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

export const undoEmailChange = createAsyncThunk(
    "account/undoEmailChange",
    async (body, { signal, rejectWithValue }) => {
        try {
            return await authApi.undoEmailChange(body, { signal });
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

export const unlinkGoogle = createAsyncThunk(
    "account/unlinkGoogle",
    async (body, { signal, rejectWithValue }) => {
        try {
            return await authApi.unlinkGoogle(body, { signal });
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

export const deleteAccount = createAsyncThunk(
    "account/deleteAccount",
    async (body, { signal, rejectWithValue }) => {
        try {
            return await authApi.deleteAccount(body, { signal });
        } catch (error) {
            return rejectWithValue(toApiError(error));
        }
    }
);

const ACCOUNT_THUNKS = [
    forgotPassword,
    validateResetToken,
    resetPassword,
    changePassword,
    changeEmail,
    confirmEmailChange,
    undoEmailChange,
    unlinkGoogle,
    deleteAccount,
];

export const accountInitialState = { ...asyncInitial, ops: {} };

const accountSlice = createSlice({
    name: "account",
    initialState: accountInitialState,
    reducers: {
        accountOpCleared(state, { payload }) {
            delete state.ops[payload];
        },
    },
    extraReducers: (builder) => {
        addOpMatchers(builder, ACCOUNT_THUNKS);
    },
});

export const { accountOpCleared } = accountSlice.actions;
export const accountReducer = accountSlice.reducer;

export const selectAccountOp = (state, name) =>
    state.account.ops[name] ?? opInitial;
