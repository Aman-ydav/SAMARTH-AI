import { Router } from "express";
import { createAuthenticate } from "#middlewares/authenticate.js";
import { validate } from "#middlewares/validate.js";
import {
    emptyBody,
    emptyQuery,
    googleBody,
    loginBody,
    registerBody,
    resendVerificationBody,
    sessionParams,
    verifyEmailBody,
} from "./auth.validation.js";
import {
    google,
    login,
    logout,
    logoutAll,
    me,
    refresh,
    register,
    resend,
    revokeSession,
    sessions,
    verify,
} from "./authSession.controller.js";

/**
 * Registration, verification, login, Google, refresh, logout, `me` and sessions (doc 08 #1, 3-6, 8-11, 19, 20).
 * Guard order on every route: rate limit, authenticate, validate, controller (BE-61).
 */
export function createSessionRoutes({ config, limiters }) {
    const router = Router();
    const authenticate = createAuthenticate({ config });

    // public: anyone may register; the answer is the same for new, existing and pending addresses
    router.post(
        "/register",
        limiters.register,
        validate({ body: registerBody }),
        register
    );
    // public: the one-time token in the body is the credential
    router.post(
        "/verify-email",
        limiters.verifyEmail,
        validate({ body: verifyEmailBody }),
        verify
    );
    // public: neutral answer for every address
    router.post(
        "/resend-verification",
        limiters.resendVerification,
        validate({ body: resendVerificationBody }),
        resend
    );
    // public: credentials in the body
    router.post(
        "/login",
        limiters.loginIp,
        limiters.loginEmail,
        validate({ body: loginBody }),
        login
    );
    // public: the Google credential in the body is the credential
    router.post(
        "/google",
        limiters.google,
        validate({ body: googleBody }),
        google
    );
    // public: authenticated by the sai_refresh cookie, not by the access cookie
    router.post(
        "/refresh",
        limiters.refresh,
        validate({ body: emptyBody }),
        refresh
    );
    // public: idempotent, works with an expired access cookie; revokes the session of the refresh cookie if any
    router.post("/logout", validate({ body: emptyBody }), logout);
    router.post(
        "/logout-all",
        authenticate,
        validate({ body: emptyBody }),
        logoutAll
    );
    router.get("/me", authenticate, validate({ query: emptyQuery }), me);
    router.get(
        "/sessions",
        authenticate,
        validate({ query: emptyQuery }),
        sessions
    );
    router.delete(
        "/sessions/:id",
        authenticate,
        validate({ params: sessionParams }),
        revokeSession
    );
    return router;
}
