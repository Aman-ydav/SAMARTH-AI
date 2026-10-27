import { z } from "zod";
import {
    hasControlCharacters,
    normalizeEmail,
    utf8ByteLength,
} from "#utils/strings.js";

/** At most this many platform admins can be listed in the environment (R68). */
export const MAX_PLATFORM_ADMINS = 10;

// Same numbers as the password policy (AUTH-21, R4). The full policy (denylist, name) runs again when the account is created.
const MIN_PASSWORD_CHARS = 10;
const MAX_PASSWORD_BYTES = 72;
const emailSchema = z.email().max(254);

/**
 * Checks one candidate password against the part of the policy that can be decided at boot, without the denylist.
 * It names the rule, never the value. A password that equals or contains the email address, or its local part (three
 * or more characters), is refused: it is the first thing an attacker tries (AUTH-21).
 */
function passwordProblem(password, email) {
    if ([...password].length < MIN_PASSWORD_CHARS)
        return "password is shorter than 10 characters";
    if (utf8ByteLength(password) > MAX_PASSWORD_BYTES)
        return "password is longer than 72 bytes";
    if (hasControlCharacters(password))
        return "password contains control characters";
    const lower = password.toLowerCase();
    const local = email.split("@")[0];
    if (lower.includes(email) || (local.length >= 3 && lower.includes(local)))
        return "password must not contain the email address or its name part";
    return null;
}

/**
 * Parses the `PLATFORM_ADMINS` value: comma separated entries, each `email` or `email:password`.
 * The entry is split at the FIRST colon only, so a password may contain further colons (but never a comma, which
 * separates entries). Entries and parts are trimmed, emails are normalised, empty entries are ignored and a repeated
 * email keeps its first entry. An entry with a colon but no password after it is an error: leave the colon out to get a
 * set-password email instead.
 *
 * Problems are reported as `entry N: <reason>` (N counts non-empty entries from 1) and NEVER echo any part of the value.
 *
 * @param {string} [raw]
 * @returns {{ entries: Array<{ email: string, password?: string }>, issues: string[] }}
 */
export function parsePlatformAdmins(raw = "") {
    const entries = [];
    const issues = [];
    const seen = new Set();
    let position = 0;
    for (const part of String(raw).split(",")) {
        const text = part.trim();
        if (text === "") continue;
        position += 1;
        const colon = text.indexOf(":");
        const email = normalizeEmail(
            colon === -1 ? text : text.slice(0, colon)
        );
        const password =
            colon === -1 ? undefined : text.slice(colon + 1).trim();
        const problem = entryProblem(email, password);
        if (problem) {
            issues.push(`entry ${position}: ${problem}`);
            continue;
        }
        if (seen.has(email)) continue;
        seen.add(email);
        entries.push(password === undefined ? { email } : { email, password });
    }
    if (entries.length > MAX_PLATFORM_ADMINS) {
        issues.push(
            `at most ${MAX_PLATFORM_ADMINS} platform admins are allowed`
        );
    }
    return { entries, issues };
}

function entryProblem(email, password) {
    if (!emailSchema.safeParse(email).success || hasControlCharacters(email))
        return "the email address is not valid";
    if (password === undefined) return null;
    if (password === "")
        return "a colon is followed by no password (remove the colon to send a set-password email)";
    return passwordProblem(password, email);
}

/**
 * Adds the legacy `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` pair as one more entry (it needs both variables, as it
 * always did). An email already listed in `PLATFORM_ADMINS` keeps its listed entry.
 */
export function mergePlatformAdmins(listed = [], legacy = {}) {
    const entries = [...listed];
    const email = legacy.email ? normalizeEmail(legacy.email) : "";
    if (
        email &&
        legacy.password &&
        !entries.some((entry) => entry.email === email)
    ) {
        entries.push({ email, password: legacy.password });
    }
    return entries;
}

/** The zod field for `PLATFORM_ADMINS`: optional, becomes the array of entries, boot stops on any malformed entry. */
export const platformAdminsField = z
    .string()
    .optional()
    .transform((value, ctx) => {
        const { entries, issues } = parsePlatformAdmins(value ?? "");
        for (const message of issues) ctx.addIssue({ code: "custom", message });
        return issues.length > 0 ? z.NEVER : entries;
    });
