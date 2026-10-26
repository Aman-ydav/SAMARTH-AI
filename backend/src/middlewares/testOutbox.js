import { Router } from "express";
import { z } from "zod";
import { toOutboxView } from "#integrations/email/memory.adapter.js";
import { ApiResponse } from "#utils/apiResponse.js";
import { asyncHandler } from "#utils/asyncHandler.js";
import { validate } from "./validate.js";

/** Path of the test-only outbox, relative to the API prefix (TEST-42). */
export const TEST_OUTBOX_PATH = "/__test__/outbox";

/**
 * The outbox exists only when NODE_ENV is "test" AND EMAIL_TRANSPORT is "memory" (TEST-42, R39). env.js already refuses
 * the memory transport in production; this guard additionally keeps it out of development. It is not in OpenAPI.
 */
export const shouldMountTestOutbox = (config) =>
    config.nodeEnv === "test" && config.email.transport === "memory";

const querySchema = z.object({
    to: z.string().max(254).optional(),
    templateKey: z.string().max(60).optional(),
});

/** Router for `GET` (read) and `DELETE` (clear) on the memory outbox. `outbox` is the memory transport instance. */
export function testOutboxRouter(outbox) {
    const router = Router();
    router.get(
        "/",
        validate({ query: querySchema }),
        asyncHandler(async (req, res) => {
            const emails = outbox.find(req.validated.query).map(toOutboxView);
            ApiResponse.ok({ emails }, "Outbox").send(res);
        })
    );
    router.delete(
        "/",
        asyncHandler(async (_req, res) => {
            const cleared = outbox.all().length;
            outbox.clear();
            ApiResponse.ok({ cleared }, "Outbox cleared").send(res);
        })
    );
    return router;
}
