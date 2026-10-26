import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { env } from "#config/env.js";
import { logger } from "#utils/logger.js";

const STATE_NAMES = [
    "disconnected",
    "connected",
    "connecting",
    "disconnecting",
];
const instrumented = new WeakSet();

/** Logs connection lifecycle events (DB-35). Never logs the URI. Registered once per connection. */
export function registerDbEvents(
    log = logger,
    connection = mongoose.connection
) {
    if (instrumented.has(connection)) return;
    instrumented.add(connection);
    connection.on("connected", () =>
        log.info({ db: connection.name }, "mongo connected")
    );
    connection.on("disconnected", () => log.warn("mongo disconnected"));
    connection.on("reconnected", () => log.info("mongo reconnected"));
    connection.on("error", (error) =>
        log.error({ err: error }, "mongo connection error")
    );
}

/** Connection options fixed by DB-34. */
export const buildConnectOptions = ({ dbName, isProduction }) => ({
    dbName,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45_000,
    maxPoolSize: 10,
    retryWrites: true,
    w: "majority",
    bufferCommands: false,
    autoIndex: !isProduction,
});

/**
 * Connects Mongoose (call BEFORE `listen`, DB-34). Rejects if the first connect fails so the caller can exit non-zero.
 * `sanitizeFilter` makes Mongoose treat `$`-operators in user-supplied filter values as literals (BE-62).
 */
export async function connectDb({
    uri = env.db.uri,
    dbName = env.db.name,
    isProduction = env.isProduction,
    log = logger,
} = {}) {
    mongoose.set("sanitizeFilter", true);
    mongoose.set("strictQuery", true);
    registerDbEvents(log);
    await mongoose.connect(uri, buildConnectOptions({ dbName, isProduction }));
    return mongoose.connection;
}

/** Closes the connection (graceful shutdown, tests). Safe to call when already disconnected. */
export async function disconnectDb() {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

/** "connected" | "connecting" | "disconnecting" | "disconnected" (exposed by /ready, DB-35). */
export const getDbState = () =>
    STATE_NAMES[mongoose.connection.readyState] ?? "disconnected";

/** True when the database answers a ping within `timeoutMs`; false on any failure or when not connected. */
export async function pingDb(timeoutMs = 2000) {
    if (mongoose.connection.readyState !== 1) return false;
    let timer;
    try {
        const deadline = new Promise((_resolve, reject) => {
            timer = setTimeout(
                () => reject(new Error("ping timeout")),
                timeoutMs
            );
        });
        await Promise.race([mongoose.connection.db.admin().ping(), deadline]);
        return true;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Runs `main()` between connect and disconnect when the file is executed directly (`node src/db/x.js`).
 * Exits non-zero on failure. Does nothing when the module is merely imported (tests, other code).
 */
export async function runAsScript(
    importMetaUrl,
    main,
    {
        exit = process.exit,
        argv = process.argv,
        connect = connectDb,
        disconnect = disconnectDb,
    } = {}
) {
    if (!argv[1] || importMetaUrl !== pathToFileURL(argv[1]).href) return;
    let code = 0;
    try {
        await connect();
        await main(argv.slice(2));
    } catch (error) {
        logger.error({ err: error }, "script failed");
        code = 1;
    } finally {
        await disconnect();
    }
    exit(code);
}
