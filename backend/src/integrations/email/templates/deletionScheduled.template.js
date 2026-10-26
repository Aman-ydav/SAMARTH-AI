import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { defineTemplate } from "../emailLayout.mapper.js";

export const deletionScheduledTemplate = defineTemplate({
    key: EMAIL_TEMPLATES.DELETION_SCHEDULED,
    required: ["name", "graceEndsAt", "link"],
    links: ["link"],
    en: (d) => ({
        subject: "Your SAMARTH AI account is scheduled for deletion",
        heading: "Your account is scheduled for deletion",
        paragraphs: [
            `Hello ${d.name},`,
            `Your account and personal data will be deleted on ${d.graceEndsAt}. Signing in before then cancels the deletion.`,
        ],
        action: { label: "Cancel the deletion", url: d.link },
        note: "If you did not request this, sign in and reset your password.",
    }),
});
