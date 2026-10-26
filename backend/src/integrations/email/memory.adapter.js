import { randomUUID } from "node:crypto";
import { readFragmentToken } from "./emailLinks.mapper.js";

const DEFAULT_LIMIT = 200;

/**
 * In-memory transport for tests (TEST-24): keeps what was "sent" so tests assert on it instead of parsing logs.
 * It stores the raw template variables, so it must never exist in production (env.js refuses EMAIL_TRANSPORT=memory there).
 */
export function createMemoryTransport({ limit = DEFAULT_LIMIT } = {}) {
    const outbox = [];
    return {
        name: "memory",
        async send(message) {
            const stored = {
                id: randomUUID(),
                sentAt: new Date().toISOString(),
                ...message,
            };
            outbox.push(stored);
            if (outbox.length > limit) outbox.shift();
            return { messageId: stored.id };
        },
        /** All captured emails, oldest first (copy). */
        all: () => [...outbox],
        /** Emails matching `{ to?, templateKey? }`, oldest first. */
        find: ({ to, templateKey } = {}) =>
            outbox.filter(
                (mail) =>
                    (to === undefined || mail.to === to) &&
                    (templateKey === undefined ||
                        mail.templateKey === templateKey)
            ),
        /** Newest matching email or undefined. */
        latest(filter = {}) {
            return this.find(filter).at(-1);
        },
        clear() {
            outbox.length = 0;
        },
    };
}

/** Links found in a captured email's variables. */
export const linksOf = (mail) =>
    Object.values(mail?.data ?? {}).filter(
        (value) => typeof value === "string" && /^https?:\/\//.test(value)
    );

/** The one-time token carried in the fragment of the first link of a captured email, or null. */
export const tokenOf = (mail) =>
    linksOf(mail).map(readFragmentToken).find(Boolean) ?? null;

/** Shape returned by the test-only outbox endpoint: enough for Postman to read a one-time token. */
export const toOutboxView = (mail) => ({
    id: mail.id,
    to: mail.to,
    templateKey: mail.templateKey,
    lang: mail.lang,
    subject: mail.subject,
    text: mail.text,
    links: linksOf(mail),
    token: tokenOf(mail),
    sentAt: mail.sentAt,
});
