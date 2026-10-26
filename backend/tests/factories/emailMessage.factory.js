import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { buildFrontendLink } from "#integrations/email/emailLinks.mapper.js";

let counter = 0;

/**
 * A valid `{ to, templateKey, data }` for `enqueueEmail` / `sendEmail` (TEST-20). Uses the reserved domain example.test.
 * The default is a verification mail whose link carries `token` in the fragment.
 */
export function makeEmailMessage({
    token = `token-${(counter += 1)}`,
    ...overrides
} = {}) {
    return {
        to: `learner${counter}@example.test`,
        templateKey: EMAIL_TEMPLATES.VERIFY_EMAIL,
        data: {
            name: "Test Learner",
            link: buildFrontendLink("/verify-email", { token }),
            expiresIn: "24 hours",
        },
        ...overrides,
    };
}
