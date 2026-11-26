import { Router } from "express";
import { env } from "#config/env.js";
import { ROLES } from "#constants/roles.js";
import { createAuthenticate } from "#middlewares/authenticate.js";
import { authorize } from "#middlewares/authorize.js";
import { createLimiter } from "#middlewares/rateLimit.js";
import { validate } from "#middlewares/validate.js";
import { ORGANISATION_LIMITS } from "./organisation.constants.js";
import {
    createOrganisationHandler,
    deactivateOrganisationHandler,
    listOrganisationsHandler,
    restoreOrganisationHandler,
    updateOrganisationHandler,
} from "./organisation.controller.js";
import {
    createOrganisationBody,
    listOrganisationsQuery,
    organisationIdParams,
    updateOrganisationBody,
} from "./organisation.validation.js";

const byUser = (spec) =>
    createLimiter({
        ...spec,
        ipScoped: false,
        key: (req) => req.auth?.userId ?? "anonymous",
    });

export function createOrganisationRouter({ config = env } = {}) {
    const router = Router();
    const authenticate = createAuthenticate({ config });
    const platformAdmin = authorize(ROLES.SUPERADMIN);
    const readLimit = byUser(ORGANISATION_LIMITS.read);
    const writeLimit = byUser(ORGANISATION_LIMITS.write);
    router.get(
        "/",
        authenticate,
        platformAdmin,
        readLimit,
        validate({ query: listOrganisationsQuery }),
        listOrganisationsHandler
    );
    router.post(
        "/",
        authenticate,
        platformAdmin,
        writeLimit,
        validate({ body: createOrganisationBody }),
        createOrganisationHandler
    );
    router.patch(
        "/:id",
        authenticate,
        platformAdmin,
        writeLimit,
        validate({
            params: organisationIdParams,
            body: updateOrganisationBody,
        }),
        updateOrganisationHandler
    );
    router.delete(
        "/:id",
        authenticate,
        platformAdmin,
        writeLimit,
        validate({ params: organisationIdParams }),
        deactivateOrganisationHandler
    );
    router.post(
        "/:id/restore",
        authenticate,
        platformAdmin,
        writeLimit,
        validate({ params: organisationIdParams }),
        restoreOrganisationHandler
    );
    return router;
}
