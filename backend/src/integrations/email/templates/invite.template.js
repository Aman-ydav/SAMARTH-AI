import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { defineTemplate } from "../emailLayout.mapper.js";

export const inviteTemplate = defineTemplate({
    key: EMAIL_TEMPLATES.INVITE,
    required: ["inviterName", "orgName", "role", "link", "expiresIn"],
    links: ["link"],
    en: (d) => ({
        subject: "You are invited to SAMARTH AI",
        heading: "You are invited to SAMARTH AI",
        paragraphs: [
            `${d.inviterName} invited you to join ${d.orgName} on SAMARTH AI as ${d.role}.`,
            `The invitation is valid for ${d.expiresIn}.`,
        ],
        action: { label: "Accept the invitation", url: d.link },
        note: "If you were not expecting this invitation, you can ignore this email.",
    }),
});
