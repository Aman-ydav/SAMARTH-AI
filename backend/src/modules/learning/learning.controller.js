import { ApiResponse } from "#utils/apiResponse.js";
import { asyncHandler } from "#utils/asyncHandler.js";
import * as learningService from "./learning.service.js";

export const listCourses = asyncHandler(async (req, res) => {
    const { domain, competencyId, provider, search } = req.query;
    const courses = await learningService.getCourses({ domain, competencyId, provider, search });
    return ApiResponse.ok({ courses }, "Course catalogue").send(res);
});

export const getCourseDetail = asyncHandler(async (req, res) => {
    const course = await learningService.getCourseById(req.params.id);
    return ApiResponse.ok({ course }, "Course details").send(res);
});

export const getMyRecommendations = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const targetRole = req.query.targetRole || "statistical_officer";
    const data = await learningService.getRecommendationsForUser(userId, targetRole);
    return ApiResponse.ok(data, "Recommended learning items").send(res);
});

export const getMyLearningPath = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const targetRole = req.query.targetRole || "statistical_officer";
    const pathData = await learningService.getLearningPath(userId, targetRole);
    return ApiResponse.ok({ learningPath: pathData }, "Personalised learning pathway").send(res);
});

export const enroll = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const courseId = req.body.courseId;
    const enrolment = await learningService.enrollInCourse(userId, courseId);
    return ApiResponse.ok({ enrolment }, "Enrolled successfully").send(res);
});

export const getMyEnrolments = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const enrolments = await learningService.getUserEnrolments(userId);
    return ApiResponse.ok({ enrolments }, "User enrolments").send(res);
});

export const updateProgress = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const courseId = req.params.id;
    const { progressPercent } = req.body;
    const updated = await learningService.updateEnrolmentProgress(userId, courseId, progressPercent);
    return ApiResponse.ok({ enrolment: updated }, "Enrolment progress updated").send(res);
});
