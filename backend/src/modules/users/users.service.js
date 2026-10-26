import { ERROR_CODES } from "#constants/errorCodes.js";
import { ROLES } from "#constants/roles.js";
import { USER_STATUSES } from "#constants/statuses.js";
import { ApiError } from "#utils/apiError.js";
import { anyOf, ne } from "#utils/mongoOps.js";
import { normalizeEmail } from "#utils/strings.js";
import { User } from "./user.model.js";

const ADMIN_ROLES = [ROLES.ADMIN, ROLES.SUPERADMIN];

/**
 * Auth user summary (doc 08 section 3): what `data.user` carries on login, verify, Google, invite and `GET /auth/me`.
 * It is an explicit allow-list (BE-47): no hash, history, device list or token version. `hasPassword` needs the
 * document loaded with `+passwordHash` (or pass `hasPassword` yourself).
 */
export function toAuthUser(user, { hasPassword } = {}) {
    const plain = typeof user.toObject === "function" ? user.toObject() : user;
    return {
        id: String(plain._id ?? plain.id),
        email: plain.email,
        name: plain.name,
        role: plain.role,
        orgId: String(plain.orgId),
        status: plain.status,
        locale: plain.locale,
        emailVerified: Boolean(plain.emailVerified),
        authProviders: [...(plain.authProviders ?? [])],
        hasPassword: hasPassword ?? Boolean(plain.passwordHash),
        avatar: plain.avatar
            ? {
                  publicId: plain.avatar.publicId,
                  version: plain.avatar.version ?? null,
              }
            : null,
        mustChangePassword: Boolean(plain.mustChangePassword),
    };
}

/**
 * Login-type responses add `needsOnboarding` (doc 08, doc 20 section 13). Milestone 1 has no profile collection yet,
 * so the only signal is missing consent (seeded accounts); the wizard itself arrives with the profile module.
 */
export const needsOnboarding = (user) => !user.termsAcceptedAt;

/** Finds a live (not soft-deleted) user by email after normalising it (AUTH-26). */
export function findUserByEmail(email, { select = "" } = {}) {
    return User.findOne({ email: normalizeEmail(email) }).select(select);
}

/** `GET /auth/me`: the user summary plus `needsOnboarding`; 404 when the account no longer exists. */
export async function getCurrentUser(userId) {
    const user = await User.findById(userId).select("+passwordHash").lean();
    if (!user) throw ApiError.notFound(ERROR_CODES.NOT_FOUND);
    return { user: toAuthUser(user), needsOnboarding: needsOnboarding(user) };
}

/** The user summary alone (what other modules, for example media, return after changing the account). */
export async function getAuthUser(userId) {
    return (await getCurrentUser(userId)).user;
}

/** Profile = summary plus the editable preferences. */
export async function getProfile(userId) {
    const user = await User.findById(userId).select("+passwordHash").lean();
    if (!user) throw ApiError.notFound(ERROR_CODES.NOT_FOUND);
    return { ...toAuthUser(user), timezone: user.timezone };
}

/**
 * Updates the whitelisted profile fields (`name`, `locale`, `timezone`) and nothing else (AUTH-59, DB-15): role, status,
 * orgId and email can never change through this path because they are not copied from the input.
 */
export async function updateProfile(userId, input) {
    const patch = {};
    for (const field of ["name", "locale", "timezone"]) {
        if (input[field] !== undefined) patch[field] = input[field];
    }
    const user = await User.findByIdAndUpdate(
        userId,
        { $set: patch },
        { returnDocument: "after", runValidators: true }
    )
        .select("+passwordHash")
        .lean();
    if (!user) throw ApiError.notFound(ERROR_CODES.NOT_FOUND);
    return { ...toAuthUser(user), timezone: user.timezone };
}

/**
 * Throws 409 LAST_ADMIN when `user` is an active admin or superadmin and no other active admin-level user exists in the
 * org (AUTH-61). Used before anything that removes an admin: deletion, deactivation, demotion, suspension.
 */
export async function assertNotLastAdmin(user, { session } = {}) {
    if (!ADMIN_ROLES.includes(user.role)) return;
    const others = await User.countDocuments({
        orgId: user.orgId,
        role: anyOf(ADMIN_ROLES),
        status: USER_STATUSES.ACTIVE,
        _id: ne(user._id),
    }).session(session ?? null);
    if (others > 0) return;
    throw ApiError.conflict(ERROR_CODES.LAST_ADMIN);
}
