import { randomUUID } from "node:crypto";
import { logger as rootLogger } from "#utils/logger.js";
import { linksOf } from "./memory.adapter.js";

/**
 * Development transport: records that a mail would have been sent. It logs the template key, the recipient HASH and the
 * subject, never the body, because links carry one-time tokens (BE-72, AUTH-24).
 *
 * Exception R40: with `printLinks` (the email service sets it only when NODE_ENV=development) the action links are
 * printed too, labelled DEV ONLY, so a developer can click verify and reset links without Brevo. Never in test or production.
 */
export function createLogTransport({
    log = rootLogger,
    printLinks = false,
} = {}) {
    return {
        name: "log",
        async send(message) {
            const { templateKey, toHash, subject } = message;
            const messageId = randomUUID();
            const entry = {
                event: "email.sent",
                transport: "log",
                templateKey,
                recipient: toHash,
                subject,
                messageId,
            };
            if (printLinks) entry.devLinks = linksOf(message);
            log.info(
                entry,
                printLinks
                    ? "email (log transport) DEV ONLY: action links printed"
                    : "email (log transport)"
            );
            return { messageId };
        },
    };
}
