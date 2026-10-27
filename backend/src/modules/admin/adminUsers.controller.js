import { ApiResponse } from "#utils/apiResponse.js";
import { asyncHandler } from "#utils/asyncHandler.js";
import * as adminUsers from "./adminUsers.service.js";

export const listUsersHandler = asyncHandler(async (req, res) => {
    const { items, meta } = await adminUsers.listUsers(
        req.auth,
        req.validated.query
    );
    return ApiResponse.ok({ users: items }, "Users", meta).send(res);
});

export const setStatusHandler = asyncHandler(async (req, res) => {
    const user = await adminUsers.setUserStatus(
        req.auth,
        req.validated.params.id,
        req.validated.body.status
    );
    return ApiResponse.ok({ user }, "Account status updated").send(res);
});

export const changeRoleHandler = asyncHandler(async (req, res) => {
    const user = await adminUsers.changeUserRole(
        req.auth,
        req.validated.params.id,
        req.validated.body.role
    );
    return ApiResponse.ok({ user }, "Role updated").send(res);
});
