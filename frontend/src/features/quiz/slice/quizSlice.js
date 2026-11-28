import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as quizApi from "@/features/quiz/api/quizApi";
import { ApiError, toApiError } from "@/lib/apiError";
import { STATUS } from "@/lib/asyncState";

const op = () => ({ status: STATUS.IDLE, error: null });
const failure = (action) => action.payload ?? toApiError(action.error);
const reject = (thunk) => async (arg, api) => {
    try {
        return await thunk(arg, api);
    } catch (error) {
        return api.rejectWithValue(toApiError(error));
    }
};

export const fetchQuizzes = createAsyncThunk(
    "quiz/fetchQuizzes",
    reject((_arg, { signal }) => quizApi.listQuizzes({ signal })),
    {
        condition: (_arg, { getState }) =>
            getState().quiz.list.status !== STATUS.LOADING,
    }
);

export const fetchQuiz = createAsyncThunk(
    "quiz/fetchQuiz",
    reject(async (id, { signal }) => {
        const quiz = await quizApi.getQuiz(id, { signal });
        if (!quiz) throw new ApiError({ statusCode: 404, code: "NOT_FOUND" });
        return quiz;
    })
);

export const fetchMyAttempts = createAsyncThunk(
    "quiz/fetchMyAttempts",
    reject((_arg, { signal }) => quizApi.listMyAttempts({ signal })),
    {
        condition: (_arg, { getState }) =>
            getState().quiz.attempts.status !== STATUS.LOADING,
    }
);

/**
 * Sends the answers once. Single-flight: a second dispatch (double click, or the timer firing while a click is in
 * flight) is dropped while one runs. Never computes a score; the stored result is exactly what the server returned.
 */
export const submitQuiz = createAsyncThunk(
    "quiz/submitQuiz",
    reject(async ({ quizId }, { getState, signal }) => {
        const { answers } = getState().quiz.session;
        const body = Object.entries(answers).map(
            ([questionId, selectedOptionIndex]) => ({
                questionId,
                selectedOptionIndex,
            })
        );
        const result = await quizApi.submitAttempt(quizId, body, { signal });
        if (!result) throw new ApiError({ statusCode: 502, code: "UNKNOWN" });
        return result;
    }),
    {
        condition: (_arg, { getState }) =>
            getState().quiz.submit.status !== STATUS.LOADING,
    }
);

const emptySession = { quizId: null, answers: {}, current: 0 };

export const quizInitialState = {
    list: { ...op(), items: [] },
    attempts: { ...op(), items: [] },
    detail: { ...op(), quiz: null },
    session: emptySession,
    submit: op(),
    results: {},
    lastResultId: null,
};

const quizSlice = createSlice({
    name: "quiz",
    initialState: quizInitialState,
    reducers: {
        attemptStarted(state, { payload }) {
            state.session = { quizId: payload, answers: {}, current: 0 };
            state.submit = op();
        },
        answerSet(state, { payload: { questionId, optionIndex } }) {
            state.session.answers[questionId] = optionIndex;
        },
        questionChanged(state, { payload }) {
            state.session.current = Math.max(0, payload);
        },
        submitCleared(state) {
            state.submit = op();
        },
    },
    extraReducers: (builder) => {
        const lists = [
            [fetchQuizzes, "list", "items"],
            [fetchMyAttempts, "attempts", "items"],
            [fetchQuiz, "detail", "quiz"],
        ];
        for (const [thunk, key, field] of lists) {
            builder
                .addCase(thunk.pending, (state) => {
                    state[key].status = STATUS.LOADING;
                    state[key].error = null;
                })
                .addCase(thunk.fulfilled, (state, { payload }) => {
                    state[key] = {
                        status: STATUS.SUCCEEDED,
                        error: null,
                        [field]: payload,
                    };
                })
                .addCase(thunk.rejected, (state, action) => {
                    if (action.meta.aborted) return;
                    state[key].status = STATUS.FAILED;
                    state[key].error = failure(action);
                });
        }
        builder
            .addCase(submitQuiz.pending, (state) => {
                state.submit = { status: STATUS.LOADING, error: null };
            })
            .addCase(submitQuiz.fulfilled, (state, { payload }) => {
                state.submit = { status: STATUS.SUCCEEDED, error: null };
                state.results[payload.id] = payload;
                state.lastResultId = payload.id;
                state.attempts.status = STATUS.IDLE;
            })
            .addCase(submitQuiz.rejected, (state, action) => {
                state.submit = action.meta.aborted
                    ? op()
                    : { status: STATUS.FAILED, error: failure(action) };
            });
    },
});

export const { attemptStarted, answerSet, questionChanged, submitCleared } =
    quizSlice.actions;
export const quizReducer = quizSlice.reducer;
export const selectQuiz = (state) => state.quiz;
