import { ApiResponse } from "#utils/apiResponse.js";
import { asyncHandler } from "#utils/asyncHandler.js";
import { DEFAULT_TARGET_ROLE } from "./competency.constants.js";
import { calculateGapAnalysis } from "./competencyGap.service.js";
import * as competencyService from "./competency.service.js";

/** Who is asking comes from the verified session, never from the request (EDGE-22). */
const userIdOf = (req) => req.auth.userId;

export const listCompetencies = asyncHandler(async (_req, res) => {
    const competencies = await competencyService.getCompetencies();
    return ApiResponse.ok({ competencies }, "Competency framework").send(res);
});

export const listRoles = asyncHandler(async (_req, res) => {
    const roles = await competencyService.getRoleProfiles();
    return ApiResponse.ok({ roles }, "Role profiles").send(res);
});

export const getRoleRequirements = asyncHandler(async (req, res) => {
    const role = await competencyService.getRoleProfileById(
        req.validated.params.id
    );
    return ApiResponse.ok({ role }, "Role requirements").send(res);
});

export const getMyCompetencies = asyncHandler(async (req, res) => {
    const competencies = await competencyService.getUserCompetencies(
        userIdOf(req)
    );
    return ApiResponse.ok({ competencies }, "My competency profile").send(res);
});

export const submitSelfAssessment = asyncHandler(async (req, res) => {
    const updated = await competencyService.saveSelfAssessment(
        userIdOf(req),
        req.validated.body.ratings
    );
    return ApiResponse.ok(
        { competencies: updated },
        "Self assessment saved"
    ).send(res);
});

export const getMyGaps = asyncHandler(async (req, res) => {
    const targetRole = req.validated.query.targetRole ?? DEFAULT_TARGET_ROLE;
    const gapAnalysis = await calculateGapAnalysis(userIdOf(req), targetRole);
    return ApiResponse.ok({ gapAnalysis }, "Skill gap analysis").send(res);
});
