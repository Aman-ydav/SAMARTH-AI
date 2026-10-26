import bcrypt from "bcryptjs";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { BCRYPT_COST } from "#constants/tokenTypes.js";
import { ApiError } from "#utils/apiError.js";
import { utf8ByteLength } from "#utils/strings.js";
import { PASSWORD_RULES } from "./auth.constants.js";
import { COMMON_PASSWORDS } from "./passwordDenylist.constants.js";

// Fixed cost-12 hash of a throw-away value. Compared against when the account is missing or has no password, so
// every login attempt spends the same time in bcrypt (AUTH-23, AUTH-34).
const DUMMY_HASH =
    "$2b$12$7zDYSrxjGJihwx9P.x2zGOV8v4U1IBrBPah9xqj8D2ioKbd9F/uum";

const squash = (value) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const DENYLIST = new Set(COMMON_PASSWORDS.map(squash));

/** bcrypt hash with the configured cost (AUTH-20). Callers validate the policy first: bcrypt ignores bytes past 72. */
export const hashPassword = (password) => bcrypt.hash(password, BCRYPT_COST);

/**
 * True when `password` matches `hash`. A missing hash never matches, and neither does a password over 72 bytes (bcrypt
 * would silently ignore the tail, AUTH-22); both still cost one compare so the timing does not tell them apart.
 */
export async function verifyPassword(password, hash) {
    const unusable =
        typeof hash !== "string" ||
        hash === "" ||
        utf8ByteLength(password) > PASSWORD_RULES.MAX_BYTES;
    if (unusable) return dummyCompare(password);
    return bcrypt.compare(password, hash);
}

/** Spends one bcrypt compare against the fixed dummy hash and returns false (timing equalisation). */
export async function dummyCompare(password) {
    await bcrypt.compare(String(password ?? ""), DUMMY_HASH);
    return false;
}

const localPartOf = (email) =>
    String(email ?? "")
        .split("@")[0]
        .toLowerCase();

function mentionsName(lowerPassword, name) {
    const words = String(name ?? "")
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length >= 4);
    return words.some((word) => lowerPassword.includes(word));
}

/**
 * Checks the password policy (AUTH-21, R4) and returns the list of violated rule codes (empty when fine):
 * `too_short` (under 10 characters), `too_long` (over 72 UTF-8 bytes), `common`, `repeated`, `contains_email`,
 * `contains_name`.
 */
export function checkPasswordPolicy(password, { email, name } = {}) {
    const problems = [];
    const text = String(password ?? "");
    if ([...text].length < PASSWORD_RULES.MIN_LENGTH)
        problems.push("too_short");
    if (utf8ByteLength(text) > PASSWORD_RULES.MAX_BYTES)
        problems.push("too_long");
    const lower = text.toLowerCase();
    if (DENYLIST.has(squash(text))) problems.push("common");
    if (/^(.)\1+$/u.test(text)) problems.push("repeated");
    const local = localPartOf(email);
    if (local.length >= 3 && lower.includes(local))
        problems.push("contains_email");
    if (mentionsName(lower, name)) problems.push("contains_name");
    return problems;
}

const POLICY_MESSAGES = Object.freeze({
    too_short: `Use at least ${PASSWORD_RULES.MIN_LENGTH} characters.`,
    too_long: `Use at most ${PASSWORD_RULES.MAX_BYTES} bytes (some characters take more than one).`,
    common: "This password is too common.",
    repeated: "Do not repeat a single character.",
    contains_email: "The password must not contain your email name.",
    contains_name: "The password must not contain your name.",
});

/** Throws 400 PASSWORD_POLICY with one `errors[]` entry per violated rule; the password itself is never echoed. */
export function assertPasswordPolicy(
    password,
    context = {},
    field = "password"
) {
    const problems = checkPasswordPolicy(password, context);
    if (problems.length === 0) return;
    throw ApiError.badRequest(ERROR_CODES.PASSWORD_POLICY, {
        errors: problems.map((code) => ({
            field,
            message: POLICY_MESSAGES[code],
            code,
        })),
    });
}

/** True when `password` equals any of the given bcrypt hashes (the current one and the last three, AUTH-25). */
export async function matchesAny(password, hashes) {
    for (const hash of hashes.filter(Boolean)) {
        if (await bcrypt.compare(password, hash)) return true;
    }
    return false;
}

/** Throws 400 PASSWORD_REUSED when the new password equals the current hash or one of the kept history hashes. */
export async function assertNotReused(
    password,
    { passwordHash, passwordHistory = [] },
    field = "newPassword"
) {
    if (!(await matchesAny(password, [passwordHash, ...passwordHistory])))
        return;
    throw ApiError.badRequest(ERROR_CODES.PASSWORD_REUSED, {
        errors: [
            {
                field,
                message: "Choose a password you have not used recently.",
                code: ERROR_CODES.PASSWORD_REUSED,
            },
        ],
    });
}

/** The history to store after a change: previous hash first, at most `HISTORY_SIZE` entries. */
export const nextPasswordHistory = (previousHash, history = []) =>
    (previousHash ? [previousHash, ...history] : [...history]).slice(
        0,
        PASSWORD_RULES.HISTORY_SIZE
    );
