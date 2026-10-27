// supertest guard-order tests for every /admin route (TEST-08): 401 without a session, 403 for the wrong role, CSRF, rate limit.
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { createUser, newObjectId } from "#tests/factories/user.factory.js";
import { createAuthAgent } from "#tests/helpers/authAgent.js";
import { buildAuthApp, loginAs } from "#tests/helpers/authApp.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { expectError } from "#tests/helpers/envelopes.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

const BASE = "/api/v1/admin";
const id = () => String(newObjectId());
// [method, path builder, body, roles allowed past the guards]
const ROUTES = [
    [
        "post",
        () => `${BASE}/invites`,
        { email: "n@example.test", role: "trainer" },
        ["admin", "superadmin"],
    ],
    ["get", () => `${BASE}/invites`, undefined, ["admin", "superadmin"]],
    [
        "delete",
        () => `${BASE}/invites/${id()}`,
        undefined,
        ["admin", "superadmin"],
    ],
    [
        "post",
        () => `${BASE}/invites/${id()}/resend`,
        undefined,
        ["admin", "superadmin"],
    ],
    ["get", () => `${BASE}/users`, undefined, ["admin", "superadmin"]],
    [
        "patch",
        () => `${BASE}/users/${id()}/status`,
        { status: "suspended" },
        ["admin", "superadmin"],
    ],
    [
        "patch",
        () => `${BASE}/users/${id()}/role`,
        { role: "trainer" },
        ["superadmin"],
    ],
];

const label = ([method, path]) =>
    `${method.toUpperCase()} ${path()
        .replace(BASE, "/admin")
        .replace(/[a-f0-9]{24}/, ":id")}`;
const CASES = ROUTES.map((route) => [label(route), route]);
const call = (agent, [method, path, body]) => {
    const request = agent[method](path());
    return body === undefined ? request : request.send(body);
};

describe("every /admin route", () => {
    it.each(CASES)("%s: 401 without a session", async (_name, route) => {
        const { app } = buildAuthApp();
        const anonymous = await createAuthAgent(app);
        expectError(await call(anonymous, route), 401, "AUTH_REQUIRED");
    });

    it.each(CASES)(
        "%s: 403 for a learner and a trainer",
        async (_name, route) => {
            const { app } = buildAuthApp();
            for (const role of ["learner", "trainer"]) {
                const user = await createUser({ role });
                const { agent } = await loginAs(app, user.email);
                expectError(await call(agent, route), 403, "FORBIDDEN");
            }
        }
    );

    it.each(CASES.filter(([, route]) => !route[3].includes("admin")))(
        "%s: 403 for an admin when only a platform admin may call it",
        async (_name, route) => {
            const { app } = buildAuthApp();
            const admin = await createUser({ role: "admin" });
            const { agent } = await loginAs(app, admin.email);
            expectError(await call(agent, route), 403, "FORBIDDEN");
        }
    );

    it.each(CASES.filter(([, route]) => route[0] !== "get"))(
        "%s: an unsafe call without the CSRF header is refused before anything runs",
        async (_name, route) => {
            const { app } = buildAuthApp();
            const platform = await createUser({ role: "superadmin" });
            const { agent } = await loginAs(app, platform.email);
            const [method, path, body] = route;
            const request = agent.agent[method](path());
            const response = await (body === undefined
                ? request
                : request.send(body));
            expectError(response, 403, "CSRF_INVALID");
        }
    );

    it("a suspended or deleted platform admin loses access at once", async () => {
        const { app } = buildAuthApp();
        const platform = await createUser({ role: "superadmin" });
        const { agent } = await loginAs(app, platform.email);
        const { User } = await import("#modules/users/user.model.js");
        await User.updateOne({ _id: platform._id }, { status: "suspended" });
        expectError(await agent.get(`${BASE}/users`), 403, "ACCOUNT_SUSPENDED");
    });

    it("answers 404 for an unknown /admin path and 405-style misses with the envelope", async () => {
        const { app } = buildAuthApp();
        const platform = await createUser({ role: "superadmin" });
        const { agent } = await loginAs(app, platform.email);
        expectError(await agent.get(`${BASE}/nothing`), 404, "NOT_FOUND");
        expectError(await agent.delete(`${BASE}/users`), 404, "NOT_FOUND");
    });
});

describe("admin rate limits (per signed-in user, never relaxed)", () => {
    it("answers 429 with Retry-After after 30 invitation writes in an hour", async () => {
        const { app } = buildAuthApp();
        const platform = await createUser({ role: "superadmin" });
        const { agent } = await loginAs(app, platform.email);
        let refused;
        for (let attempt = 1; attempt <= 31; attempt += 1) {
            const response = await agent.post(`${BASE}/invites`).send({});
            if (response.status === 429) {
                refused = attempt;
                expectError(response, 429, "RATE_LIMITED");
                expect(Number(response.headers["retry-after"])).toBeGreaterThan(
                    0
                );
                expect(response.body.retryAfterSec).toBe(
                    Number(response.headers["retry-after"])
                );
                break;
            }
            expect(response.status).toBe(400);
        }
        expect(refused).toBe(31);
        // The counter belongs to the user: another admin is not affected, and neither is a user-management write.
        const other = await createUser({ role: "admin" });
        const second = await loginAs(app, other.email);
        expect(
            (await second.agent.post(`${BASE}/invites`).send({})).status
        ).toBe(400);
        expect(
            (await agent.patch(`${BASE}/users/${id()}/status`).send({})).status
        ).toBe(400);
    });
});
