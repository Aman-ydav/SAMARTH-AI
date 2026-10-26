import { ApiResponse } from "#utils/apiResponse.js";
import { asyncHandler } from "#utils/asyncHandler.js";
import * as usersService from "./users.service.js";

export const getProfile = asyncHandler(async (req, res) => {
    const user = await usersService.getProfile(req.auth.userId);
    return ApiResponse.ok({ user }, "Profile").send(res);
});

export const updateProfile = asyncHandler(async (req, res) => {
    const user = await usersService.updateProfile(
        req.auth.userId,
        req.validated.body
    );
    return ApiResponse.ok({ user }, "Profile updated").send(res);
});
