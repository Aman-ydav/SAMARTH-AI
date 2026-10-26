import { Router } from "express";
import { createAuthenticate } from "#middlewares/authenticate.js";
import { validate } from "#middlewares/validate.js";
import {
    acceptInviteBody,
    changeEmailBody,
    deleteAccountBody,
    tokenBody,
    unlinkGoogleBody,
} from "./auth.validation.js";
import {
    acceptInvite,
    changeEmail,
    confirmChangeEmail,
    deleteAccount,
    undoChangeEmail,
    unlinkGoogle,
} from "./authAccount.controller.js";

/** Unlink Google, email change (request, confirm, undo), account deletion and invite acceptance (doc 08 #7, 16-18, 21, 22). */
export function createAccountRoutes({ config, limiters }) {
    const router = Router();
    const authenticate = createAuthenticate({ config });

    router.delete(
        "/google",
        authenticate,
        limiters.unlinkGoogle,
        validate({ body: unlinkGoogleBody }),
        unlinkGoogle
    );
    router.post(
        "/change-email",
        authenticate,
        limiters.changeEmail,
        validate({ body: changeEmailBody }),
        changeEmail
    );
    // public: the one-time token in the body is the credential
    router.post(
        "/change-email/confirm",
        limiters.changeEmailToken,
        validate({ body: tokenBody }),
        confirmChangeEmail
    );
    // public: the undo token in the body is the credential
    router.post(
        "/change-email/undo",
        limiters.changeEmailToken,
        validate({ body: tokenBody }),
        undoChangeEmail
    );
    router.delete(
        "/account",
        authenticate,
        limiters.deleteAccount,
        validate({ body: deleteAccountBody }),
        deleteAccount
    );
    // public: the invite token in the body is the credential
    router.post(
        "/accept-invite",
        limiters.acceptInvite,
        validate({ body: acceptInviteBody }),
        acceptInvite
    );
    return router;
}
