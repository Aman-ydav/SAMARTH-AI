import { Router } from "express";
import { createAuthenticate } from "#middlewares/authenticate.js";
import { validate } from "#middlewares/validate.js";
import {
    changePasswordBody,
    forgotPasswordBody,
    resetPasswordBody,
    tokenBody,
} from "./auth.validation.js";
import {
    changePassword,
    forgotPassword,
    resetPassword,
    validateReset,
} from "./authPassword.controller.js";

/** Forgot, reset (with validate) and change password (doc 08 #12-15). */
export function createPasswordRoutes({ config, limiters }) {
    const router = Router();
    // The only route a must-change-password (limited) session may call (AUTH-38).
    const authenticate = createAuthenticate({
        config,
        allowLimited: true,
    });

    // public: neutral answer; the work happens after the response
    router.post(
        "/forgot-password",
        limiters.forgotIp,
        validate({ body: forgotPasswordBody }),
        forgotPassword
    );
    // public: non-consuming check of the one-time token in the body (R34)
    router.post(
        "/reset-password/validate",
        limiters.reset,
        validate({ body: tokenBody }),
        validateReset
    );
    // public: the one-time token in the body is the credential
    router.post(
        "/reset-password",
        limiters.reset,
        validate({ body: resetPasswordBody }),
        resetPassword
    );
    router.post(
        "/change-password",
        authenticate,
        limiters.changePassword,
        validate({ body: changePasswordBody }),
        changePassword
    );
    return router;
}
