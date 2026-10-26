import { env } from "#config/env.js";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { createBrevoTransport } from "#integrations/email/brevo.adapter.js";
import { createLogTransport } from "#integrations/email/log.adapter.js";
import { createMemoryTransport } from "#integrations/email/memory.adapter.js";
import { renderEmail } from "#integrations/email/templateRenderer.adapter.js";
import { ApiError } from "#utils/apiError.js";
import { hmacIdentifier } from "#utils/hash.js";
import { logger as rootLogger } from "#utils/logger.js";
import { normalizeEmail } from "#utils/strings.js";

const RETRY_DELAYS_MS = Object.freeze([1000, 5000, 25_000]);
const MAX_RECORDED_FAILURES = 50;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildTransport(config, log) {
    const { transport, brevoApiKey, fromAddress, fromName, replyTo } =
        config.email;
    if (transport === "memory") return createMemoryTransport();
    if (transport === "brevo")
        return createBrevoTransport({
            apiKey: brevoApiKey,
            fromAddress,
            fromName,
            replyTo,
        });
    // R40: action links are printed only for the log transport in development.
    return createLogTransport({ log, printLinks: config.isDevelopment });
}

/**
 * Email service (BE-70..73): renders a template and hands it to the transport chosen by EMAIL_TRANSPORT.
 * `sendEmail` awaits delivery and throws on failure. `enqueueEmail` is the one to call from request flows: it returns
 * immediately, delivers after the response with bounded retries, and records (never swallows) the final failure.
 */
export function createEmailService({
    config = env,
    log = rootLogger,
    transport,
    retryDelaysMs = RETRY_DELAYS_MS,
    sleep = wait,
} = {}) {
    let activeTransport = transport;
    const pending = new Set();
    const failures = [];
    const stats = { sent: 0, failed: 0 };
    const getTransport = () =>
        (activeTransport ??= buildTransport(config, log));

    async function sendEmail({ to, templateKey, data, lang = "en" }) {
        const recipient = normalizeEmail(to);
        if (!EMAIL_SHAPE.test(recipient) || recipient.length > 254) {
            throw ApiError.internal(ERROR_CODES.INTERNAL, {
                message: "Invalid email recipient",
                isOperational: false,
            });
        }
        const rendered = renderEmail(
            { templateKey, data, lang },
            config.frontendUrl
        );
        const result = await getTransport().send({
            to: recipient,
            toHash: hmacIdentifier(recipient, config.auth.identifierHashSecret),
            templateKey,
            lang: rendered.lang,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            data,
        });
        stats.sent += 1;
        return {
            messageId: result?.messageId ?? null,
            transport: getTransport().name,
        };
    }

    function recordFailure({ message, requestId, attempts, error }) {
        stats.failed += 1;
        const entry = {
            at: new Date().toISOString(),
            templateKey: message.templateKey,
            recipient: hmacIdentifier(
                normalizeEmail(message.to),
                config.auth.identifierHashSecret
            ),
            requestId: requestId ?? null,
            attempts,
            code: error?.code ?? ERROR_CODES.INTERNAL,
        };
        failures.push(entry);
        if (failures.length > MAX_RECORDED_FAILURES) failures.shift();
        log.error({ err: error, ...entry }, "email delivery failed");
        return entry;
    }

    async function deliver(message, requestId) {
        await new Promise((resolve) => setImmediate(resolve));
        let attempts = 0;
        for (;;) {
            attempts += 1;
            try {
                return await sendEmail(message);
            } catch (error) {
                const retryable =
                    error?.isOperational === true && error.statusCode >= 500;
                const delay = retryDelaysMs[attempts - 1];
                if (!retryable || delay === undefined)
                    return recordFailure({
                        message,
                        requestId,
                        attempts,
                        error,
                    });
                await sleep(delay);
            }
        }
    }

    return {
        sendEmail,
        /**
         * Fire-and-forget (BE-73). Call after the DB write; never `await` it in a request. Returns nothing.
         * @param {{ to: string, templateKey: string, data: object, lang?: string }} message
         * @param {{ requestId?: string }} [options] request id for failure logs
         */
        enqueueEmail(message, { requestId } = {}) {
            const task = deliver(message, requestId).finally(() =>
                pending.delete(task)
            );
            pending.add(task);
        },
        /** Resolves when every queued email has been delivered or recorded as failed (tests, graceful shutdown). */
        async whenSettled() {
            while (pending.size > 0) await Promise.allSettled([...pending]);
        },
        /** Final failures (recipient hash only), newest last, capped at 50. */
        getFailures: () => [...failures],
        getStats: () => ({ ...stats }),
        /** The memory transport (for the test outbox) or undefined for log/brevo. */
        get outbox() {
            const current = getTransport();
            return current.name === "memory" ? current : undefined;
        },
        get transportName() {
            return getTransport().name;
        },
    };
}

export const emailService = createEmailService();
export const { sendEmail, enqueueEmail } = emailService;
