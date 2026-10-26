/**
 * Graceful shutdown on SIGTERM/SIGINT (BE-06): stop accepting, drain, run `closers` (e.g. close Mongoose), exit.
 * A hard timeout forces a non-zero exit. `exit` and `proc` are injectable for tests.
 * @returns {(signal: string) => Promise<void>} the shutdown routine (also callable directly)
 */
export function registerGracefulShutdown({
    server,
    closers = [],
    logger,
    timeoutMs = 10_000,
    exit = process.exit,
    proc = process,
}) {
    let shuttingDown = false;

    const shutdown = async (signal) => {
        if (shuttingDown) return;
        shuttingDown = true;
        logger.info({ signal }, "shutdown started");
        const timer = setTimeout(() => {
            logger.error({ signal }, "shutdown timed out, forcing exit");
            exit(1);
        }, timeoutMs);
        timer.unref?.();
        try {
            await new Promise((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()));
                server.closeIdleConnections?.();
            });
            for (const close of closers) await close();
            clearTimeout(timer);
            logger.info("shutdown complete");
            exit(0);
        } catch (error) {
            clearTimeout(timer);
            logger.error({ err: error }, "shutdown failed");
            exit(1);
        }
    };

    proc.on("SIGTERM", () => shutdown("SIGTERM"));
    proc.on("SIGINT", () => shutdown("SIGINT"));
    return shutdown;
}

/** Logs and exits non-zero on uncaughtException and unhandledRejection so the platform restarts the process (BE-07). */
export function registerProcessGuards({
    logger,
    exit = process.exit,
    proc = process,
}) {
    const fatal = (kind) => (reason) => {
        logger.fatal({ err: reason }, kind);
        exit(1);
    };
    proc.on("uncaughtException", fatal("uncaughtException"));
    proc.on("unhandledRejection", fatal("unhandledRejection"));
}
