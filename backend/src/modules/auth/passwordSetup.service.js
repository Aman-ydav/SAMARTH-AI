import {
    EMAIL_TEMPLATES,
    PASSWORD_RESET_VARIANTS,
} from "#constants/emailTemplates.js";
import { AUTH_TOKEN_TYPES } from "#constants/tokenTypes.js";
import { buildFrontendLink } from "#integrations/email/emailLinks.mapper.js";
import { FRONTEND_PATHS } from "./auth.constants.js";
import { describeTtl } from "./register.service.js";
import { issueEmailToken } from "./tokens.service.js";

/**
 * Issues the one-time link that lets an account without a password choose one (R68): the existing password-reset token
 * (30 minutes, single use, fragment link) with the `setup` mail variant. It is the same flow as "Forgot password", so the
 * consumer is `POST /auth/reset-password`, which also bumps the token version and clears `mustChangePassword`.
 *
 * Returns the mail message for the caller to queue AFTER its transaction commits (DB-33); nothing is sent here.
 *
 * @param {{ _id: unknown, email: string, name: string, orgId: unknown, locale?: string }} user
 * @param {{ config: object, session?: import("mongoose").ClientSession, now?: Date }} options
 */
export async function issuePasswordSetup(
    user,
    { config, session, now = new Date() }
) {
    const { token } = await issueEmailToken(
        {
            type: AUTH_TOKEN_TYPES.PASSWORD_RESET,
            userId: user._id,
            orgId: user.orgId,
            email: user.email,
        },
        { session, now }
    );
    return {
        to: user.email,
        templateKey: EMAIL_TEMPLATES.PASSWORD_RESET,
        lang: user.locale ?? "en",
        data: {
            name: user.name,
            link: buildFrontendLink(
                FRONTEND_PATHS.RESET_PASSWORD,
                { token },
                config.frontendUrl
            ),
            expiresIn: describeTtl(AUTH_TOKEN_TYPES.PASSWORD_RESET),
            requestedAt: now.toISOString(),
            variant: PASSWORD_RESET_VARIANTS.SETUP,
        },
    };
}
