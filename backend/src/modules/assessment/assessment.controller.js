import { ApiResponse } from "#utils/apiResponse.js";
import { asyncHandler } from "#utils/asyncHandler.js";
import * as assessmentService from "./assessment.service.js";

export const listQuizzes = asyncHandler(async (req, res) => {
    const { competencyId, domain } = req.query;
    const quizzes = await assessmentService.getQuizzes({ competencyId, domain });
    return ApiResponse.ok({ quizzes }, "Available quizzes").send(res);
});

export const getQuiz = asyncHandler(async (req, res) => {
    const quiz = await assessmentService.getQuizForAttempt(req.params.id);
    return ApiResponse.ok({ quiz }, "Quiz details").send(res);
});

export const submitAttempt = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const quizId = req.params.id;
    const answers = req.body.answers;
    const result = await assessmentService.submitQuizAttempt(userId, quizId, answers);
    return ApiResponse.ok({ result }, "Quiz evaluated successfully").send(res);
});

export const getMyAttempts = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const attempts = await assessmentService.getUserAttempts(userId);
    return ApiResponse.ok({ attempts }, "My assessment history").send(res);
});

export const getAttemptDetails = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const attempt = await assessmentService.getAttemptById(userId, req.params.attemptId);
    return ApiResponse.ok({ attempt }, "Attempt details").send(res);
});
