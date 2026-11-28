import { ApiResponse } from "#utils/apiResponse.js";
import { asyncHandler } from "#utils/asyncHandler.js";
import * as assessmentService from "./assessment.service.js";

/** Who is asking comes from the verified session, never from the request (EDGE-22). */
const userIdOf = (req) => req.auth.userId;

export const listQuizzes = asyncHandler(async (req, res) => {
    const { competencyId, domain } = req.validated.query;
    const quizzes = await assessmentService.getQuizzes({
        competencyId,
        domain,
    });
    return ApiResponse.ok({ quizzes }, "Available quizzes").send(res);
});

export const getQuiz = asyncHandler(async (req, res) => {
    const quiz = await assessmentService.getQuizForAttempt(
        req.validated.params.id
    );
    return ApiResponse.ok({ quiz }, "Quiz details").send(res);
});

export const submitAttempt = asyncHandler(async (req, res) => {
    const result = await assessmentService.submitQuizAttempt(
        userIdOf(req),
        req.validated.params.id,
        req.validated.body.answers
    );
    return ApiResponse.ok({ result }, "Quiz evaluated successfully").send(res);
});

export const getMyAttempts = asyncHandler(async (req, res) => {
    const attempts = await assessmentService.getUserAttempts(userIdOf(req));
    return ApiResponse.ok({ attempts }, "My assessment history").send(res);
});

export const getAttemptDetails = asyncHandler(async (req, res) => {
    const attempt = await assessmentService.getAttemptById(
        userIdOf(req),
        req.validated.params.attemptId
    );
    return ApiResponse.ok({ attempt }, "Attempt details").send(res);
});
