import { ApiResponse } from "#utils/apiResponse.js";
import { asyncHandler } from "#utils/asyncHandler.js";
import { simulateTamper } from "./auditDemo.service.js";
import { getChainStatus, listAuditEntries } from "./auditRead.service.js";

/** The demo switch of this router's config; tolerant of a test config without the `audit` group. */
const tamperDemoOn = (req) => req.deps?.config?.audit?.tamperDemo === true;

export const listAuditHandler = asyncHandler(async (req, res) => {
    const { items, meta } = await listAuditEntries({
        role: req.auth.role,
        orgId: req.auth.orgId,
        query: req.validated.query,
    });
    return ApiResponse.ok({ entries: items }, "Audit entries", meta).send(res);
});

export const verifyChainHandler = asyncHandler(async (req, res) => {
    const chain = await getChainStatus({
        tamperDemoEnabled: tamperDemoOn(req),
    });
    return ApiResponse.ok({ chain }, "Audit chain status").send(res);
});

export const simulateTamperHandler = asyncHandler(async (req, res) => {
    const simulation = await simulateTamper({ seq: req.validated.body.seq });
    return ApiResponse.ok({ simulation }, "Tamper simulation").send(res);
});
