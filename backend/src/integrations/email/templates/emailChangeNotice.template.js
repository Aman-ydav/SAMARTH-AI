import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { defineTemplate } from "../emailLayout.mapper.js";

export const emailChangeNoticeTemplate = defineTemplate({
    key: EMAIL_TEMPLATES.EMAIL_CHANGE_NOTICE,
    required: ["name", "newEmailMasked", "undoLink", "expiresIn"],
    links: ["undoLink"],
    en: (d) => ({
        subject: "Your SAMARTH AI email address is changing",
        heading: "Your email address is changing",
        paragraphs: [
            `Hello ${d.name},`,
            `A request was made to change the email on your SAMARTH AI account to ${d.newEmailMasked}. It applies only after the new address confirms.`,
            `If this was not you, undo it within ${d.expiresIn}. Undoing signs out every device.`,
        ],
        action: { label: "Undo this change", url: d.undoLink },
    }),
});
