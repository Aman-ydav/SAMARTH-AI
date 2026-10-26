import { hmacIdentifier } from "#utils/hash.js";
import { anyOf, gt } from "#utils/mongoOps.js";
import { normalizeEmail } from "#utils/strings.js";
import { secondsUntil } from "#utils/dates.js";
import { LOCKOUT } from "./auth.constants.js";
import { LOGIN_ATTEMPT_KINDS, LoginAttempt } from "./loginAttempt.model.js";

/** Shadow-counter key of an email: HMAC of the normalised address (AUTH-36). The same value for real and fake accounts. */
export const emailAttemptKey = (email, config) =>
    hmacIdentifier(normalizeEmail(email), config.auth.identifierHashSecret);

/** Lock length for the `count`-th failure at or after `threshold`: 15 min, doubling per repeat, never above 24 h. */
export const lockDurationMs = (count, threshold = LOCKOUT.THRESHOLD) =>
    Math.min(
        LOCKOUT.BASE_MS * 2 ** Math.max(0, count - threshold),
        LOCKOUT.MAX_MS
    );

async function bump(keyHash, kind, now) {
    const update = {
        $inc: { count: 1 },
        $set: { kind, lastAttemptAt: now },
        $setOnInsert: { firstAttemptAt: now },
    };
    const options = { upsert: true, returnDocument: "after" };
    try {
        return await LoginAttempt.findOneAndUpdate(
            { keyHash },
            update,
            options
        ).lean();
    } catch (error) {
        // Two first failures racing to create the row: the loser retries as a plain increment.
        if (error?.code !== 11000) throw error;
        return LoginAttempt.findOneAndUpdate(
            { keyHash },
            update,
            options
        ).lean();
    }
}

/**
 * The active lock for this email key or IP key, or null. Reads only the shadow rows, so a locked real account and a
 * locked unknown email look identical (AUTH-36). `retryAfterSec` is what the client shows.
 */
export async function getActiveLock({ emailKey, ipKey }, now = new Date()) {
    const keys = [emailKey, ipKey].filter(Boolean);
    const [row] = await LoginAttempt.find({
        keyHash: anyOf(keys),
        lockUntil: gt(now),
    })
        .sort({ lockUntil: -1 })
        .limit(2)
        .lean();
    if (!row) return null;
    return {
        lockUntil: row.lockUntil,
        retryAfterSec: secondsUntil(row.lockUntil, now),
    };
}

async function applyLock(keyHash, count, threshold, now) {
    if (count < threshold) return null;
    const lockUntil = new Date(
        now.getTime() + lockDurationMs(count, threshold)
    );
    await LoginAttempt.updateOne({ keyHash }, { $set: { lockUntil } });
    return lockUntil;
}

/**
 * Counts one failed password attempt for the email key (and the IP key when given) and locks when a threshold is
 * reached. Unknown emails are counted exactly like real ones. Returns the email counter state:
 * `{ count, lockUntil, justLocked }` where `justLocked` is true only for the failure that first reaches the threshold.
 */
export async function recordFailure({ emailKey, ipKey }, now = new Date()) {
    const email = await bump(emailKey, LOGIN_ATTEMPT_KINDS.EMAIL, now);
    const lockUntil = await applyLock(
        emailKey,
        email.count,
        LOCKOUT.THRESHOLD,
        now
    );
    if (ipKey) {
        const ip = await bump(ipKey, LOGIN_ATTEMPT_KINDS.IP, now);
        await applyLock(ipKey, ip.count, LOCKOUT.IP_THRESHOLD, now);
    }
    return {
        count: email.count,
        lockUntil,
        justLocked: email.count === LOCKOUT.THRESHOLD,
    };
}

/** Success or password reset: forget the failures of this email (the IP counter keeps decaying on its own TTL). */
export const clearEmailAttempts = (emailKey) =>
    LoginAttempt.deleteOne({ keyHash: emailKey });
