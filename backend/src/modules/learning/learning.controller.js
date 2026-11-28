import { ApiResponse } from "#utils/apiResponse.js";
import { asyncHandler } from "#utils/asyncHandler.js";
import { buildPageMeta, parsePagination } from "#utils/pagination.js";
import { DEFAULT_TARGET_ROLE, LEARNING_LIMITS } from "./learning.constants.js";
import * as learningService from "./learning.service.js";

/** Who is asking comes from the verified session, never from the request (EDGE-22). */
const userIdOf = (req) => req.auth.userId;
const targetRoleOf = (req) =>
    req.validated.query.targetRole ?? DEFAULT_TARGET_ROLE;

export const listCourses = asyncHandler(async (req, res) => {
    const { domain, competencyId, provider, search, ...paging } =
        req.validated.query;
    const { page, limit, skip } = parsePagination(paging, {
        maxLimit: LEARNING_LIMITS.listMax,
    });
    const { items, total } = await learningService.listCourses(
        { domain, competencyId, provider, search },
        { skip, limit }
    );
    return ApiResponse.ok(
        { courses: items },
        "Course catalogue",
        buildPageMeta({ page, limit, total })
    ).send(res);
});

export const getCourseDetail = asyncHandler(async (req, res) => {
    const course = await learningService.getCourseById(req.validated.params.id);
    return ApiResponse.ok({ course }, "Course details").send(res);
});

export const getMyRecommendations = asyncHandler(async (req, res) => {
    const data = await learningService.getRecommendationsForUser(
        userIdOf(req),
        targetRoleOf(req)
    );
    return ApiResponse.ok(data, "Recommended learning items").send(res);
});

export const getMyLearningPath = asyncHandler(async (req, res) => {
    const pathData = await learningService.getLearningPath(
        userIdOf(req),
        targetRoleOf(req)
    );
    return ApiResponse.ok(
        { learningPath: pathData },
        "Personalised learning pathway"
    ).send(res);
});

export const enroll = asyncHandler(async (req, res) => {
    const enrolment = await learningService.enrollInCourse(
        userIdOf(req),
        req.validated.body.courseId
    );
    return ApiResponse.ok({ enrolment }, "Enrolled successfully").send(res);
});

export const getMyEnrolments = asyncHandler(async (req, res) => {
    const enrolments = await learningService.getUserEnrolments(userIdOf(req));
    return ApiResponse.ok({ enrolments }, "User enrolments").send(res);
});

export const updateProgress = asyncHandler(async (req, res) => {
    const updated = await learningService.updateEnrolmentProgress(
        userIdOf(req),
        req.validated.params.id,
        req.validated.body.progressPercent
    );
    return ApiResponse.ok(
        { enrolment: updated },
        "Enrolment progress updated"
    ).send(res);
});
