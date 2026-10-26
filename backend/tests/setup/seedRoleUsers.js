import { DEFAULT_ORG_ID } from "#constants/org.js";
import { ROLES } from "#constants/roles.js";
import { AUTH_PROVIDERS, USER_STATUSES } from "#constants/statuses.js";
import { runAsScript } from "#db/connect.js";
import { hashPassword } from "#modules/auth/index.js";
import { User } from "#modules/users/index.js";

// Adds the staff accounts the Postman run needs (a trainer and an admin) next to the superadmin that `npm run seed`
// creates. The role matrix of POST /media/signatures cannot be proven without them, because no HTTP route can grant a
// role yet. Reads a JSON array `[{ email, password, role, name }]` from stdin; used by test:api only.
const POLICY_VERSION = "api-test";

/** Creates the staff users if they do not exist (idempotent, never overwrites a password). Returns how many were created. */
export async function seedStaff(staff, now = new Date()) {
    let created = 0;
    for (const member of staff) {
        const result = await User.updateOne(
            { email: member.email },
            {
                $setOnInsert: {
                    orgId: DEFAULT_ORG_ID,
                    name: member.name,
                    passwordHash: await hashPassword(member.password),
                    passwordChangedAt: now,
                    role: member.role,
                    status: USER_STATUSES.ACTIVE,
                    emailVerified: true,
                    emailVerifiedAt: now,
                    authProviders: [AUTH_PROVIDERS.LOCAL],
                    mustChangePassword: false,
                    termsAcceptedAt: now,
                    policyVersion: POLICY_VERSION,
                },
            },
            { upsert: true }
        );
        created += result.upsertedCount;
    }
    return created;
}

async function readStdin() {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8");
}

export const STAFF_ROLES = Object.freeze([ROLES.TRAINER, ROLES.ADMIN]);

await runAsScript(import.meta.url, async () => {
    const staff = JSON.parse((await readStdin()) || "[]");
    if (staff.some((member) => !STAFF_ROLES.includes(member.role))) {
        throw new Error("seedRoleUsers only creates trainers and admins");
    }
    process.stdout.write(
        `${JSON.stringify({ created: await seedStaff(staff) })}\n`
    );
});
