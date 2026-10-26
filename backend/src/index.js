import { env } from "#config/env.js";
import { connectDb, disconnectDb } from "#db/connect.js";
import { emailService } from "#services/email.service.js";
import { whenBackgroundIdle } from "#utils/backgroundTasks.js";
import { logger } from "#utils/logger.js";
import {
    registerGracefulShutdown,
    registerProcessGuards,
} from "#utils/shutdown.js";
import { createApp } from "./app.js";

// Render's load balancer keeps idle connections for 60 s: stay above it to avoid sporadic 502s.
const KEEP_ALIVE_MS = 65_000;

/** Entry point (BE-01): connect the database, THEN listen (DB-34), and wire graceful shutdown (BE-06). */
async function start() {
    registerProcessGuards({ logger });
    await connectDb();
    const server = createApp().listen(env.port, () =>
        logger.info({ port: env.port, nodeEnv: env.nodeEnv }, "api listening")
    );
    server.keepAliveTimeout = KEEP_ALIVE_MS;
    server.headersTimeout = KEEP_ALIVE_MS + 1000;
    registerGracefulShutdown({
        server,
        logger,
        closers: [
            whenBackgroundIdle,
            () => emailService.whenSettled(),
            disconnectDb,
        ],
    });
}

start().catch((error) => {
    logger.fatal({ err: error }, "startup failed");
    process.exit(1);
});
