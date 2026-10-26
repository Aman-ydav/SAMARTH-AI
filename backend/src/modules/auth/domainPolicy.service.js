import { ERROR_CODES } from "#constants/errorCodes.js";
import { ApiError } from "#utils/apiError.js";
import { normalizeEmail } from "#utils/strings.js";

/**
 * Registration, Google sign-in, invites and email change share one domain policy (AUTH-28): when
 * `ALLOWED_EMAIL_DOMAINS` is set, the address must be on one of those domains or a subdomain of one. This is the only
 * rejection that may be explicit, because domains are not secret.
 */
export function isEmailDomainAllowed(email, config) {
    const allowed = config.auth.allowedEmailDomains;
    if (allowed.length === 0) return true;
    const domain = normalizeEmail(email).split("@").pop();
    return allowed.some(
        (item) => domain === item || domain.endsWith(`.${item}`)
    );
}

/** Throws 403 DOMAIN_NOT_ALLOWED (field `email`) when the address is outside the allowed domains. */
export function assertEmailDomainAllowed(email, config, field = "email") {
    if (isEmailDomainAllowed(email, config)) return;
    throw ApiError.forbidden(ERROR_CODES.DOMAIN_NOT_ALLOWED, {
        errors: [
            {
                field,
                message: "This email domain is not allowed.",
                code: ERROR_CODES.DOMAIN_NOT_ALLOWED,
            },
        ],
    });
}
