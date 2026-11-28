import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { DEFAULT_ORG_ID } from "#constants/org.js";
import { User } from "#modules/users/user.model.js";
import { createUser } from "#tests/factories/user.factory.js";
import { buildAuthApp, loginAs } from "#tests/helpers/authApp.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { expectError, expectSuccess } from "#tests/helpers/envelopes.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

const ORGANISATIONS = "/api/v1/organisations";
const settings = {
    allowSelfRegistration: true,
    allowedEmailDomains: [],
    requireEmailVerification: true,
    allowGoogleLogin: true,
};

async function world() {
    const built = buildAuthApp();
    const platform = await createUser({
        role: "superadmin",
        email: "platform@example.test",
    });
    const admin = await createUser({
        role: "admin",
        email: "admin@example.test",
    });
    return {
        ...built,
        asPlatform: await loginAs(built.app, platform.email),
        asAdmin: await loginAs(built.app, admin.email),
    };
}

describe("organisation management", () => {
    it("allows only platform admins to create and list tenants", async () => {
        const { asPlatform, asAdmin } = await world();
        const denied = await asAdmin.agent.post(ORGANISATIONS).send({
            name: "Civil Statistics",
            code: "civil-statistics",
        });
        expectError(denied, 403, "FORBIDDEN");

        const created = expectSuccess(
            await asPlatform.agent
                .post(ORGANISATIONS)
                .send({ name: "Civil Statistics", code: "civil-statistics" }),
            201
        ).data.organisation;
        expect(created).toMatchObject({
            name: "Civil Statistics",
            code: "civil-statistics",
            active: true,
            version: 0,
            settings,
        });
        expect(
            expectSuccess(await asPlatform.agent.get(ORGANISATIONS))
                .data.organisations.map(({ id }) => id)
        ).toContain(created.id);
    });

    it("enforces optimistic versions and protects the default organisation", async () => {
        const { asPlatform } = await world();
        const organisation = expectSuccess(
            await asPlatform.agent
                .post(ORGANISATIONS)
                .send({ name: "Statistics Office", code: "statistics-office" }),
            201
        ).data.organisation;

        const updated = expectSuccess(
            await asPlatform.agent
                .patch(`${ORGANISATIONS}/${organisation.id}`)
                .send({ name: "National Statistics Office", expectedVersion: 0 })
        ).data.organisation;
        expect(updated).toMatchObject({
            name: "National Statistics Office",
            version: 1,
        });
        expectError(
            await asPlatform.agent
                .patch(`${ORGANISATIONS}/${organisation.id}`)
                .send({ code: "new-code", expectedVersion: 0 }),
            409,
            "CONFLICT"
        );
        expectError(
            await asPlatform.agent.delete(
                `${ORGANISATIONS}/${DEFAULT_ORG_ID}`
            ),
            409,
            "CONFLICT"
        );
    });

    it("deactivation signs out members and restoration does not revive old sessions", async () => {
        const { app, asPlatform } = await world();
        const organisation = expectSuccess(
            await asPlatform.agent
                .post(ORGANISATIONS)
                .send({ name: "Regional Statistics", code: "regional" }),
            201
        ).data.organisation;
        const member = await createUser({
            orgId: organisation.id,
            email: "member@example.test",
        });
        const memberSession = await loginAs(app, member.email);

        const inactive = expectSuccess(
            await asPlatform.agent.delete(
                `${ORGANISATIONS}/${organisation.id}`
            )
        ).data.organisation;
        expect(inactive.active).toBe(false);
        expectError(
            await memberSession.agent.get("/api/v1/auth/me"),
            403,
            "ORGANISATION_INACTIVE"
        );

        const restored = expectSuccess(
            await asPlatform.agent.post(
                `${ORGANISATIONS}/${organisation.id}/restore`
            )
        ).data.organisation;
        expect(restored.active).toBe(true);
        expectError(
            await memberSession.agent.get("/api/v1/auth/me"),
            401,
            "TOKEN_INVALID"
        );
        expect(await User.findById(member._id).select("+tokenVersion").then((u) => u.tokenVersion))
            .toBeGreaterThan(0);
    });
});
