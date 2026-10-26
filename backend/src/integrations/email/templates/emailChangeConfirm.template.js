import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { defineTemplate } from "../emailLayout.mapper.js";

export const emailChangeConfirmTemplate = defineTemplate({
    key: EMAIL_TEMPLATES.EMAIL_CHANGE_CONFIRM,
    required: ["name", "link", "expiresIn"],
    links: ["link"],
    en: (d) => ({
        subject: "Confirm your new email address",
        heading: "Confirm your new email address",
        paragraphs: [
            `Hello ${d.name},`,
            `Confirm this address to use it for your SAMARTH AI account. The link is valid for ${d.expiresIn}.`,
        ],
        action: { label: "Confirm new email", url: d.link },
        note: "If you did not request this change, ignore this email: nothing changes until you confirm.",
    }),
});
