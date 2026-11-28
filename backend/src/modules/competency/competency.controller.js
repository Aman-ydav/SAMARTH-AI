import { ApiResponse } from "#utils/apiResponse.js";
import { asyncHandler } from "#utils/asyncHandler.js";
import * as competencyService from "./competency.service.js";

export const listCompetencies = asyncHandler(async (_req, res) => {
    const competencies = await competencyService.getCompetencies();
    return ApiResponse.ok({ competencies }, "Competency framework").send(res);
});

export const listRoles = asyncHandler(async (_req, res) => {
    const roles = await competencyService.getRoleProfiles();
    return ApiResponse.ok({ roles }, "Role profiles").send(res);
});

export const getRoleRequirements = asyncHandler(async (req, res) => {
    const role = await competencyService.getRoleProfileById(req.params.id);
    return ApiResponse.ok({ role }, "Role requirements").send(res);
});

export const getMyCompetencies = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const competencies = await competencyService.getUserCompetencies(userId);
    return ApiResponse.ok({ competencies }, "My competency profile").send(res);
});

export const submitSelfAssessment = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const ratings = req.body.ratings;
    const updated = await competencyService.saveSelfAssessment(userId, ratings);
    return ApiResponse.ok({ competencies: updated }, "Self assessment saved").send(res);
});

export const getMyGaps = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const targetRole = req.query.targetRole || "statistical_officer";
    const gapAnalysis = await competencyService.calculateGapAnalysis(userId, targetRole);
    return ApiResponse.ok({ gapAnalysis }, "Skill gap analysis").send(res);
});
