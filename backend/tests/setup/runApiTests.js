import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import newman from "newman";
import {
    API_TEST_EMAIL_DOMAIN,
    createFixtureDir,
    createRunSecrets,
} from "./apiFixtures.js";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const COLLECTION = path.join(
    ROOT,
    "postman",
    "samarthAi.postman_collection.json"
);
export const LOCAL_ENVIRONMENT = path.join(
    ROOT,
    "postman",
    "local.postman_environment.json"
);
export const JUNIT_REPORT = path.join(ROOT, "postman", "results", "junit.xml");
/** Preloaded into the API server so Cloudinary needs no network (see cloudinaryStub.js). */
export const CLOUDINARY_STUB = fileURLToPath(
    new URL("./cloudinaryStub.js", import.meta.url)
);
const say = (text) => process.stdout.write(`${text}\n`);

/** Asks the OS for a free TCP port (listen on 0, read it, close). */
export function findFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}

/** Polls `GET /health` until it answers 200 or the timeout passes. */
export async function waitForHealth(
    baseUrl,
    { timeoutMs = 30_000, intervalMs = 250, fetchImpl = fetch } = {}
) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetchImpl(`${baseUrl}/health`);
            if (response.ok) return;
        } catch {
            // The server is still starting: try again until the deadline.
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new Error(`The API did not become healthy at ${baseUrl} in time`);
}

/**
 * Environment for the API server under test (TEST-44): test mode with generated placeholder secrets, memory email
 * transport, in-memory Mongo, a raised per-IP rate limit (R10; per-account lockouts are never relaxed) and one allowed
 * email domain so the domain policy can be proven. Optional run secrets add the seeded superadmin and the Cloudinary secret.
 */
export const serverEnvironment = ({
    port,
    mongoUri,
    cloudinaryApiSecret,
    adminEmail,
    adminPassword,
}) => ({
    ...process.env,
    NODE_ENV: "test",
    PORT: String(port),
    MONGODB_URI: mongoUri,
    EMAIL_TRANSPORT: "memory",
    LOG_LEVEL: "error",
    RATE_LIMIT_IP_MULTIPLIER: "1000",
    ALLOWED_EMAIL_DOMAINS: API_TEST_EMAIL_DOMAIN,
    ...(cloudinaryApiSecret
        ? { CLOUDINARY_API_SECRET: cloudinaryApiSecret }
        : {}),
    ...(adminEmail && adminPassword
        ? { SEED_ADMIN_EMAIL: adminEmail, SEED_ADMIN_PASSWORD: adminPassword }
        : {}),
});

/** The trainer and admin that `seedRoleUsers.js` creates (read from stdin, so no password appears in argv or the environment). */
export const staffAccounts = ({
    trainerEmail,
    trainerPassword,
    orgAdminEmail,
    orgAdminPassword,
}) => [
    {
        email: trainerEmail,
        password: trainerPassword,
        role: "trainer",
        name: "Test Trainer",
    },
    {
        email: orgAdminEmail,
        password: orgAdminPassword,
        role: "admin",
        name: "Test Admin",
    },
];

/** Arguments for `node`: the Cloudinary stub is imported first, then the real entry point. */
export const serverArguments = () => [
    "--import",
    pathToFileURL(CLOUDINARY_STUB).href,
    "src/index.js",
];

/**
 * Newman options: variables are injected at run time, nothing secret lives in the files (TEST-33). `variables` adds
 * run-scoped values (seeded admin, Cloudinary secret, feature flags); `workingDir` is where `formdata` files are found.
 */
export function newmanOptions({
    baseUrl,
    hasEnvironment,
    variables = {},
    workingDir,
}) {
    const fixed = {
        baseUrl,
        apiPrefix: "/api/v1",
        expectSecureCookies: "false",
        maxResponseMs: "1000",
        allowedEmailDomain: API_TEST_EMAIL_DOMAIN,
        cloudinaryStubbed: "true",
    };
    return {
        collection: COLLECTION,
        ...(hasEnvironment ? { environment: LOCAL_ENVIRONMENT } : {}),
        ...(workingDir ? { workingDir } : {}),
        envVar: Object.entries({ ...fixed, ...variables }).map(
            ([key, value]) => ({ key, value: String(value) })
        ),
        reporters: ["cli", "junit"],
        reporter: { junit: { export: JUNIT_REPORT } },
        timeoutRequest: 30_000,
        bail: true,
    };
}

const runNewman = (options) =>
    new Promise((resolve, reject) => {
        newman.run(options, (error, summary) =>
            error
                ? reject(error)
                : resolve(summary.run.failures.length === 0 ? 0 : 1)
        );
    });

/** Runs `node <args>` in the backend folder and rejects when it exits non-zero (used to seed accounts). `input` goes to stdin. */
const runNode = (args, env, input = "") =>
    new Promise((resolve, reject) => {
        const child = spawn(process.execPath, args, {
            cwd: ROOT,
            env,
            stdio: ["pipe", "ignore", "inherit"],
        });
        child.stdin.end(input);
        child.once("error", reject);
        child.once("exit", (code) =>
            code === 0
                ? resolve()
                : reject(new Error(`${args.join(" ")} exited with ${code}`))
        );
    });

/** `npm run test:api`: in-memory Mongo + API on a free port + newman. Returns newman's exit code. */
export async function main({ collectionExists = existsSync(COLLECTION) } = {}) {
    if (!collectionExists) {
        say(
            `test:api: no Postman collection yet (expected ${path.relative(ROOT, COLLECTION)}).`
        );
        say(
            "Create it (one folder per module, TEST-30..41), then run this command again. Nothing was executed."
        );
        return 1;
    }
    const replSet = await MongoMemoryReplSet.create({
        replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    const fixtures = await createFixtureDir();
    const secrets = createRunSecrets();
    const port = await findFreePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const env = serverEnvironment({
        port,
        mongoUri: replSet.getUri(),
        ...secrets,
    });
    let server;
    try {
        await runNode(["src/seed/runSeed.js"], env);
        await runNode(
            ["tests/setup/seedRoleUsers.js"],
            env,
            JSON.stringify(staffAccounts(secrets))
        );
        server = spawn(process.execPath, serverArguments(), {
            cwd: ROOT,
            env,
            stdio: ["ignore", "inherit", "inherit"],
        });
        await Promise.race([
            waitForHealth(baseUrl),
            new Promise((_resolve, reject) =>
                server.once("exit", (code) =>
                    reject(new Error(`The API exited early with code ${code}`))
                )
            ),
        ]);
        say(`test:api: API ready at ${baseUrl}, running the collection`);
        return await runNewman(
            newmanOptions({
                baseUrl,
                hasEnvironment: existsSync(LOCAL_ENVIRONMENT),
                workingDir: fixtures.dir,
                variables: secrets,
            })
        );
    } finally {
        server?.kill();
        await fixtures.cleanup();
        await replSet.stop();
    }
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
) {
    main().then(
        (code) => process.exit(code),
        (error) => {
            process.stderr.write(`test:api failed: ${error.message}\n`);
            process.exit(1);
        }
    );
}
