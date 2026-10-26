import net from "node:net";
import { describe, expect, it, vi } from "vitest";
import {
    CLOUDINARY_STUB,
    COLLECTION,
    findFreePort,
    main,
    newmanOptions,
    serverArguments,
    serverEnvironment,
    staffAccounts,
    waitForHealth,
} from "#tests/setup/runApiTests.js";

describe("test:api runner (TEST-44)", () => {
    it("finds a free port that can be bound right away", async () => {
        const port = await findFreePort();
        expect(port).toBeGreaterThan(1023);
        await new Promise((resolve, reject) => {
            const server = net.createServer();
            server.once("error", reject);
            server.listen(port, "127.0.0.1", () => server.close(resolve));
        });
    });

    it("waits until /health answers 200", async () => {
        const fetchImpl = vi
            .fn()
            .mockRejectedValueOnce(new Error("ECONNREFUSED"))
            .mockResolvedValueOnce({ ok: false })
            .mockResolvedValue({ ok: true });
        await waitForHealth("http://127.0.0.1:1", {
            intervalMs: 1,
            timeoutMs: 1000,
            fetchImpl,
        });
        expect(fetchImpl).toHaveBeenCalledTimes(3);
        expect(fetchImpl).toHaveBeenCalledWith("http://127.0.0.1:1/health");
    });

    it("gives up with a clear error when the API never becomes healthy", async () => {
        await expect(
            waitForHealth("http://127.0.0.1:1", {
                intervalMs: 1,
                timeoutMs: 20,
                fetchImpl: async () => ({ ok: false }),
            })
        ).rejects.toThrow("did not become healthy");
    });

    it("starts the server in test mode with the memory transport, in-memory Mongo and a high per-IP multiplier", () => {
        const environment = serverEnvironment({
            port: 4321,
            mongoUri: "mongodb://127.0.0.1:1/x",
        });
        expect(environment).toMatchObject({
            NODE_ENV: "test",
            PORT: "4321",
            MONGODB_URI: "mongodb://127.0.0.1:1/x",
            EMAIL_TRANSPORT: "memory",
            RATE_LIMIT_IP_MULTIPLIER: "1000",
        });
    });

    it("restricts registration to the test email domain and hands the server its run secrets", () => {
        const environment = serverEnvironment({
            port: 1,
            mongoUri: "mongodb://127.0.0.1:1/x",
            cloudinaryApiSecret: "secret-for-this-run",
            adminEmail: "root@example.test",
            adminPassword: "Root-Password-1!",
        });
        expect(environment).toMatchObject({
            ALLOWED_EMAIL_DOMAINS: "example.test",
            CLOUDINARY_API_SECRET: "secret-for-this-run",
            SEED_ADMIN_EMAIL: "root@example.test",
            SEED_ADMIN_PASSWORD: "Root-Password-1!",
        });
        expect(environment).not.toHaveProperty("API_TEST_STAFF");
    });

    it("hands the staff accounts to the seed script as data, not through the environment", () => {
        expect(
            staffAccounts({
                trainerEmail: "t@example.test",
                trainerPassword: "Trainer-Password-1!",
                orgAdminEmail: "a@example.test",
                orgAdminPassword: "Admin-Password-1!",
            })
        ).toEqual([
            expect.objectContaining({
                email: "t@example.test",
                role: "trainer",
            }),
            expect.objectContaining({ email: "a@example.test", role: "admin" }),
        ]);
    });

    it("loads the Cloudinary stub before the entry point, so the SDK never reaches the network", () => {
        const args = serverArguments();
        expect(args[0]).toBe("--import");
        expect(args[1]).toContain(
            CLOUDINARY_STUB.replaceAll("\\", "/").split("/").pop()
        );
        expect(args.at(-1)).toBe("src/index.js");
    });

    it("passes run-scoped variables and the fixture folder to newman", () => {
        const options = newmanOptions({
            baseUrl: "http://127.0.0.1:1",
            hasEnvironment: false,
            variables: { adminEmail: "root@example.test" },
            workingDir: "/tmp/fixtures",
        });
        expect(options.workingDir).toBe("/tmp/fixtures");
        expect(options.envVar).toEqual(
            expect.arrayContaining([
                { key: "adminEmail", value: "root@example.test" },
                { key: "cloudinaryStubbed", value: "true" },
                { key: "allowedEmailDomain", value: "example.test" },
            ])
        );
    });

    it("injects run-time variables into newman, reports cli + junit and bails on the first failure", () => {
        const options = newmanOptions({
            baseUrl: "http://127.0.0.1:4321",
            hasEnvironment: false,
        });
        expect(options.collection).toBe(COLLECTION);
        expect(options).not.toHaveProperty("environment");
        expect(options.bail).toBe(true);
        expect(options.reporters).toEqual(["cli", "junit"]);
        expect(options.reporter.junit.export).toMatch(
            /results[\\/]junit\.xml$/
        );
        expect(options.envVar).toEqual(
            expect.arrayContaining([
                { key: "baseUrl", value: "http://127.0.0.1:4321" },
                { key: "apiPrefix", value: "/api/v1" },
            ])
        );
        expect(
            newmanOptions({ baseUrl: "http://x", hasEnvironment: true })
                .environment
        ).toMatch(/local\.postman_environment\.json$/);
    });

    it("exits non-zero with a clear message when the collection does not exist yet, running nothing", async () => {
        const write = vi
            .spyOn(process.stdout, "write")
            .mockImplementation(() => true);
        const code = await main({ collectionExists: false });
        const printed = write.mock.calls.map(([text]) => String(text)).join("");
        expect(code).toBe(1);
        expect(printed).toContain("no Postman collection yet");
        expect(printed).toContain("Nothing was executed");
    });
});
