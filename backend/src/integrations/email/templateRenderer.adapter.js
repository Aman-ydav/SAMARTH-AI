import { env } from "#config/env.js";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { ApiError } from "#utils/apiError.js";
import { renderLayout } from "./emailLayout.mapper.js";
import { isFrontendLink } from "./emailLinks.mapper.js";
import { accountDeletedTemplate } from "./templates/accountDeleted.template.js";
import { accountLockedTemplate } from "./templates/accountLocked.template.js";
import { alreadyRegisteredTemplate } from "./templates/alreadyRegistered.template.js";
import { deactivationConfirmTemplate } from "./templates/deactivationConfirm.template.js";
import { deletionScheduledTemplate } from "./templates/deletionScheduled.template.js";
import { emailChangeConfirmTemplate } from "./templates/emailChangeConfirm.template.js";
import { emailChangeNoticeTemplate } from "./templates/emailChangeNotice.template.js";
import { googleLinkedTemplate } from "./templates/googleLinked.template.js";
import { inviteTemplate } from "./templates/invite.template.js";
import { newDeviceTemplate } from "./templates/newDevice.template.js";
import { passwordChangedTemplate } from "./templates/passwordChanged.template.js";
import { passwordResetTemplate } from "./templates/passwordReset.template.js";
import { tokenReuseAlertTemplate } from "./templates/tokenReuseAlert.template.js";
import { verifyEmailTemplate } from "./templates/verifyEmail.template.js";
import { welcomeTemplate } from "./templates/welcome.template.js";

const TEMPLATES = [
    verifyEmailTemplate,
    welcomeTemplate,
    alreadyRegisteredTemplate,
    passwordResetTemplate,
    passwordChangedTemplate,
    newDeviceTemplate,
    emailChangeConfirmTemplate,
    emailChangeNoticeTemplate,
    inviteTemplate,
    accountLockedTemplate,
    accountDeletedTemplate,
    googleLinkedTemplate,
    tokenReuseAlertTemplate,
    deactivationConfirmTemplate,
    deletionScheduledTemplate,
];
const REGISTRY = new Map(TEMPLATES.map((template) => [template.key, template]));

/** Template keys that can be rendered. */
export const listTemplateKeys = () => [...REGISTRY.keys()];

// A bad template call is a programmer error: non-operational, answered as a generic 500 if it ever reaches a request.
const templateBug = (message) =>
    ApiError.internal(ERROR_CODES.INTERNAL, { message, isOperational: false });

/**
 * Renders `templateKey` with `data` into `{ subject, html, text, lang }`.
 * Every required variable must be a non-empty string and every link variable must point at FRONTEND_URL (AUTH-31).
 * `lang` falls back to English when a translation is missing.
 */
export function renderEmail(
    { templateKey, data = {}, lang = "en" },
    baseUrl = env.frontendUrl
) {
    const template = REGISTRY.get(templateKey);
    if (!template) throw templateBug(`Unknown email template "${templateKey}"`);
    for (const name of template.required) {
        if (typeof data[name] !== "string" || data[name].trim() === "")
            throw templateBug(
                `Email template "${templateKey}" needs "${name}"`
            );
    }
    for (const name of template.links) {
        if (!isFrontendLink(data[name], baseUrl))
            throw templateBug(
                `Email template "${templateKey}": "${name}" must be a FRONTEND_URL link`
            );
    }
    const language = template.languages[lang] ? lang : "en";
    const content = template.languages[language](data);
    return {
        subject: content.subject,
        lang: language,
        ...renderLayout({ ...content, lang: language }),
    };
}
