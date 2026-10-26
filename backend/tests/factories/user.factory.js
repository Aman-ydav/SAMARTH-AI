import mongoose from "mongoose";
import { DEFAULT_ORG_ID } from "#constants/org.js";
import { hashPassword } from "#modules/auth/password.service.js";
import { User } from "#modules/users/user.model.js";

/** Strong, not on the denylist, shares nothing with the factory names or emails. Test data only (TEST-20). */
export const TEST_PASSWORD = "Correct-Horse-Battery-Staple-42";
export const OTHER_PASSWORD = "Another-Long-Passphrase-Value-77";

let counter = 0;
let hashPromise;

/** bcrypt at cost 12 is slow, so every factory user shares one hash of TEST_PASSWORD, computed once per worker. */
export const testPasswordHash = () =>
    (hashPromise ??= hashPassword(TEST_PASSWORD));

/** Valid user fields with a unique email on the reserved domain example.test. */
export function makeUser(overrides = {}) {
    counter += 1;
    return {
        orgId: DEFAULT_ORG_ID,
        email: `learner${counter}@example.test`,
        name: `Test Person ${counter}`,
        role: "learner",
        status: "active",
        emailVerified: true,
        emailVerifiedAt: new Date(),
        authProviders: ["local"],
        termsAcceptedAt: new Date(),
        policyVersion: "test",
        ...overrides,
    };
}

/** Persists a user. Pass `passwordHash: null` for a Google-only account. */
export async function createUser(overrides = {}) {
    const data = makeUser(overrides);
    if (data.passwordHash === undefined)
        data.passwordHash = await testPasswordHash();
    if (data.passwordHash === null) delete data.passwordHash;
    return User.create(data);
}

export const newObjectId = () => new mongoose.Types.ObjectId();
