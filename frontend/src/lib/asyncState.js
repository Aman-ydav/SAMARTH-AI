import { isFulfilled, isPending, isRejected } from "@reduxjs/toolkit";
import { API_ERROR_CODES, toApiError } from "@/lib/apiError";

export const STATUS = Object.freeze({
    IDLE: "idle",
    LOADING: "loading",
    SUCCEEDED: "succeeded",
    FAILED: "failed",
});

/** Spread into every slice initial state (FE-18). */
export const asyncInitial = Object.freeze({
    status: STATUS.IDLE,
    error: null,
    lastFetchedAt: null,
});

/** Default cache lifetimes in ms (FE-24). */
export const TTL = Object.freeze({
    me: 5 * 60 * 1000,
    reference: 10 * 60 * 1000,
    dashboard: 60 * 1000,
    adminList: 30 * 1000,
    notifications: 0,
});

/** True while a timestamp is still inside its TTL window. A TTL of 0 never counts as fresh. */
export function isFresh(lastFetchedAt, ttlMs, now = Date.now()) {
    if (typeof lastFetchedAt !== "number" || !(ttlMs > 0)) return false;
    return now - lastFetchedAt < ttlMs;
}

/** Operation record for slices that run several independent mutations. */
export const opInitial = Object.freeze({ status: STATUS.IDLE, error: null });

const opName = (action) => action.type.split("/")[1];

/**
 * Registers pending/fulfilled/rejected matchers that keep a per-operation `{ status, error }` record in
 * `state.ops[<thunkName>]` for slices that run several independent mutations (FE-18).
 * Call it last inside the `extraReducers` builder callback.
 */
export function addOpMatchers(builder, thunks) {
    builder
        .addMatcher(isPending(...thunks), (state, action) => {
            state.ops[opName(action)] = { status: STATUS.LOADING, error: null };
        })
        .addMatcher(isFulfilled(...thunks), (state, action) => {
            state.ops[opName(action)] = {
                status: STATUS.SUCCEEDED,
                error: null,
            };
        })
        .addMatcher(isRejected(...thunks), (state, action) => {
            const cancelled =
                action.meta.aborted ||
                action.payload?.code === API_ERROR_CODES.REQUEST_CANCELED;
            state.ops[opName(action)] = cancelled
                ? { status: STATUS.IDLE, error: null }
                : {
                      status: STATUS.FAILED,
                      error: action.payload ?? toApiError(action.error),
                  };
        });
}
