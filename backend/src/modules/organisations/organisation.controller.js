import { ApiResponse } from "#utils/apiResponse.js";
import { asyncHandler } from "#utils/asyncHandler.js";
import * as organisations from "./organisation.service.js";

export const listOrganisationsHandler = asyncHandler(async (req, res) => {
    const { items, meta } = await organisations.listOrganisations(
        req.validated.query
    );
    return ApiResponse.ok(
        { organisations: items },
        "Organisations",
        meta
    ).send(res);
});

export const createOrganisationHandler = asyncHandler(async (req, res) => {
    const organisation = await organisations.createOrganisation(
        req.validated.body,
        req.auth
    );
    return ApiResponse.created({ organisation }, "Organisation created").send(
        res
    );
});

export const updateOrganisationHandler = asyncHandler(async (req, res) => {
    const organisation = await organisations.updateOrganisation(
        req.validated.params.id,
        req.validated.body,
        req.auth
    );
    return ApiResponse.ok({ organisation }, "Organisation updated").send(res);
});

export const deactivateOrganisationHandler = asyncHandler(
    async (req, res) => {
        const organisation = await organisations.deactivateOrganisation(
            req.validated.params.id,
            req.auth
        );
        return ApiResponse.ok(
            { organisation },
            "Organisation deactivated"
        ).send(res);
    }
);

export const restoreOrganisationHandler = asyncHandler(async (req, res) => {
    const organisation = await organisations.restoreOrganisation(
        req.validated.params.id,
        req.auth
    );
    return ApiResponse.ok({ organisation }, "Organisation restored").send(res);
});
