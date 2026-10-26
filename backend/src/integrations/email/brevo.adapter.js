import { BrevoClient } from "@getbrevo/brevo";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { ApiError } from "#utils/apiError.js";

const REQUEST_TIMEOUT_SECONDS = 15;

/**
 * Brevo transactional-email transport (the only importer of @getbrevo/brevo). Sender and reply-to come from config
 * (BE-71). One attempt per call with a timeout: the email queue owns retries so a retry never doubles up with the SDK's.
 */
export function createBrevoTransport({
    apiKey,
    fromAddress,
    fromName,
    replyTo,
    client = new BrevoClient({ apiKey }),
}) {
    return {
        name: "brevo",
        async send({ to, subject, html, text, templateKey }) {
            try {
                const response =
                    await client.transactionalEmails.sendTransacEmail(
                        {
                            sender: { email: fromAddress, name: fromName },
                            to: [{ email: to }],
                            subject,
                            htmlContent: html,
                            textContent: text,
                            tags: [templateKey],
                            ...(replyTo ? { replyTo: { email: replyTo } } : {}),
                        },
                        {
                            timeoutInSeconds: REQUEST_TIMEOUT_SECONDS,
                            maxRetries: 0,
                        }
                    );
                return { messageId: response?.messageId ?? null };
            } catch (error) {
                throw ApiError.badGateway(ERROR_CODES.INTEGRATION_ERROR, {
                    cause: error,
                });
            }
        },
    };
}
