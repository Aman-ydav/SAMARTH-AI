// supertest route tests (TEST-08) for GET/PUT /profile.
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
import { expectError, expectSuccess } from "#tests/helpers/envelopes.js";
import { User } from "./user.model.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

const PROFILE = "/api/v1/profile";

describe("GET /profile", () => {
    it("answers 401 without a session and the summary plus timezone with one", async () => {
        const { app } = buildAuthApp();
        const anonymous = await createAuthAgent(app);
        expectError(await anonymous.get(PROFILE), 401, "AUTH_REQUIRED");
        const user = await createUser();
        const { agent } = await loginAs(app, user.email);
        const body = expectSuccess(await agent.get(PROFILE));
        expect(body.data.user).toMatchObject({
            id: String(user._id),
            email: user.email,
            timezone: "Asia/Kolkata",
            locale: "en",
        });
        expect(JSON.stringify(body)).not.toMatch(
            /passwordHash|tokenVersion|knownDevice/
        );
    });

    it("rejects query parameters", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const { agent } = await loginAs(app, user.email);
        expectError(
            await agent.get(`${PROFILE}?role=admin`),
            400,
            "VALIDATION_ERROR"
        );
    });
});

describe("PUT /profile", () => {
    it("updates name, locale and timezone, partially", async () => {
        const { app } = buildAuthApp();
        const user = await createUser({ name: "Before Name" });
        const { agent } = await loginAs(app, user.email);
        const body = expectSuccess(
            await agent
                .put(PROFILE)
                .send({ locale: "hi", timezone: "Europe/Paris" })
        );
        expect(body.data.user).toMatchObject({
            name: "Before Name",
            locale: "hi",
            timezone: "Europe/Paris",
        });
        const second = expectSuccess(
            await agent.put(PROFILE).send({ name: "  After Name  " })
        );
        expect(second.data.user).toMatchObject({
            name: "After Name",
            locale: "hi",
        });
        expect(await User.findById(user._id).lean()).toMatchObject({
            name: "After Name",
            locale: "hi",
        });
    });

    it.each([
        ["role", { role: "superadmin" }],
        ["status", { status: "suspended" }],
        ["email", { email: "hijack@example.test" }],
        ["orgId", { orgId: "000000000000000000000002" }],
        ["tokenVersion", { tokenVersion: 5 }],
        ["emailVerified", { emailVerified: false }],
    ])("refuses the protected field %s (AUTH-59)", async (field, patch) => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const { agent } = await loginAs(app, user.email);
        const error = expectError(
            await agent.put(PROFILE).send({ name: "Ok Name", ...patch }),
            400,
            "VALIDATION_ERROR"
        );
        expect(error.errors).toEqual([
            expect.objectContaining({ field, message: "Unknown field" }),
        ]);
        expect(await User.findById(user._id).lean()).toMatchObject({
            role: "learner",
            status: "active",
            email: user.email,
        });
    });

    it.each([
        ["an empty body", {}],
        ["a blank name", { name: "   " }],
        ["a long name", { name: "x".repeat(101) }],
        ["an unknown locale", { locale: "fr" }],
        ["an unknown timezone", { timezone: "Mars/Olympus" }],
        ["control characters", { name: "Ana\u0007" }],
        ["a non-string name", { name: { $gt: "" } }],
    ])("rejects %s with 400 VALIDATION_ERROR", async (_label, body) => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const { agent } = await loginAs(app, user.email);
        expectError(
            await agent.put(PROFILE).send(body),
            400,
            "VALIDATION_ERROR"
        );
    });

    it("needs a session and the CSRF header", async () => {
        const { app } = buildAuthApp();
        const anonymous = await createAuthAgent(app);
        expectError(
            await anonymous.put(PROFILE).send({ name: "Ok Name" }),
            401,
            "AUTH_REQUIRED"
        );
        const user = await createUser();
        const { agent } = await loginAs(app, user.email);
        expectError(
            await agent.agent.put(PROFILE).send({ name: "Ok Name" }),
            403,
            "CSRF_INVALID"
        );
    });

    it("stops working as soon as the account is suspended", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const { agent } = await loginAs(app, user.email);
        await User.updateOne({ _id: user._id }, { status: "suspended" });
        expectError(
            await agent.put(PROFILE).send({ name: "Still Me" }),
            403,
            "ACCOUNT_SUSPENDED"
        );
    });
});
