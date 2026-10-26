import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { createUser } from "#tests/factories/user.factory.js";
import { createAuthAgent } from "#tests/helpers/authAgent.js";
import { buildAuthApp, loginAs } from "#tests/helpers/authApp.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { expectError } from "#tests/helpers/envelopes.js";
import { authenticate } from "./authenticate.js";
import { authorize } from "./authorize.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

const run = (middleware, req) => {
    const next = vi.fn();
    middleware(req, {}, next);
    return next.mock.calls[0][0];
};

describe("authorize", () => {
    it("calls next without an error for a listed role", () => {
        expect(
            run(authorize("admin", "superadmin"), { auth: { role: "admin" } })
        ).toBeUndefined();
        expect(
            run(authorize("learner"), { auth: { role: "learner" } })
        ).toBeUndefined();
    });

    it("answers FORBIDDEN 403 for an unlisted role, with no implicit hierarchy", () => {
        expect(
            run(authorize("admin"), { auth: { role: "learner" } })
        ).toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
        expect(
            run(authorize("admin"), { auth: { role: "superadmin" } })
        ).toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    });

    it("answers AUTH_REQUIRED when it runs before authenticate", () => {
        expect(run(authorize("admin"), {})).toMatchObject({
            statusCode: 401,
            code: "AUTH_REQUIRED",
        });
    });

    it("refuses to be built without roles", () => {
        expect(() => authorize()).toThrow(/at least one role/);
    });
});

// Supertest: the guard chain authenticate -> authorize on a real route (TEST-08: 401 without cookie, 403 for the wrong role).
describe("authorize behind authenticate (Supertest)", () => {
    beforeAll(startAuthDb);
    afterAll(stopTestDb);
    beforeEach(resetAuthDb);

    const build = () =>
        buildAuthApp({
            extraRoutes: (api) =>
                api.get(
                    "/admin-only",
                    authenticate,
                    authorize("admin", "superadmin"),
                    (_req, res) => res.json({ ok: true })
                ),
        });

    it("answers 401 without a session", async () => {
        const { app } = build();
        expectError(
            await (await createAuthAgent(app)).get("/api/v1/admin-only"),
            401,
            "AUTH_REQUIRED"
        );
    });

    it.each(["learner", "trainer"])(
        "answers 403 FORBIDDEN for a %s",
        async (role) => {
            const { app } = build();
            const user = await createUser({ role });
            const { agent } = await loginAs(app, user.email);
            expectError(
                await agent.get("/api/v1/admin-only"),
                403,
                "FORBIDDEN"
            );
        }
    );

    it.each(["admin", "superadmin"])("lets a %s through", async (role) => {
        const { app } = build();
        const user = await createUser({ role });
        const { agent } = await loginAs(app, user.email);
        expect((await agent.get("/api/v1/admin-only")).body).toEqual({
            ok: true,
        });
    });

    it("uses the role from the database after a change, without a new login", async () => {
        const { app } = build();
        const user = await createUser({ role: "admin" });
        const { agent } = await loginAs(app, user.email);
        const { User } = await import("#modules/users/user.model.js");
        await User.updateOne({ _id: user._id }, { role: "learner" });
        expectError(await agent.get("/api/v1/admin-only"), 403, "FORBIDDEN");
    });
});
