import { ApiResponse } from "#utils/apiResponse.js";
import { asyncHandler } from "#utils/asyncHandler.js";
import * as jobs from "./jobs.service.js";

export const getJobHandler = asyncHandler(async (req, res) => {
    const job = await jobs.getOwnJob({
        jobId: req.validated.params.id,
        userId: req.auth.userId,
        orgId: req.auth.orgId,
    });
    return ApiResponse.ok({ job }, "Job").send(res);
});
