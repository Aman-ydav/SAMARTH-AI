import { ERROR_CODES } from "#constants/errorCodes.js";
import { ApiError } from "#utils/apiError.js";
import { verifyPassword } from "./password.service.js";

const reauthRequired = (message) =>
    ApiError.forbidden(ERROR_CODES.REAUTH_REQUIRED, { message });

/**
 * Proves the signed-in user is really present before a sensitive change (AUTH-55): the current password or, for
 * accounts that sign in with Google, a fresh Google credential whose `sub` is the one linked to the account.
 *
 * - wrong current password: 401 INVALID_CREDENTIALS (doc 20 section 9);
 * - no usable proof (no password on the account, no credential, another Google account): 403 REAUTH_REQUIRED.
 *
 * `user` must have been loaded with `+passwordHash`.
 */
export async function reauthenticate(
    { user, currentPassword, credential },
    ctx
) {
    if (currentPassword !== undefined) {
        if (!user.passwordHash)
            throw reauthRequired("Confirm with Google instead.");
        const matches = await verifyPassword(
            currentPassword,
            user.passwordHash
        );
        if (!matches)
            throw ApiError.unauthorized(ERROR_CODES.INVALID_CREDENTIALS);
        return;
    }
    if (credential !== undefined) {
        const profile = await ctx.verifyGoogleCredential(credential);
        if (!user.googleSub || profile.sub !== user.googleSub) {
            throw reauthRequired(
                "Use the Google account linked to this profile."
            );
        }
        return;
    }
    throw reauthRequired("Confirm your identity first.");
}
