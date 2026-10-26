import { logger as rootLogger } from "./logger.js";

const running = new Set();

/**
 * Runs `work` after the current request has been answered, so response time does not depend on what the work does
 * (AUTH-33, AUTH-46). Failures are logged and never reach the caller. Tests and shutdown await `whenBackgroundIdle`.
 * @param {() => Promise<unknown>} work
 * @param {{ log?: { error: Function }, label?: string }} [options]
 */
export function runInBackground(
    work,
    { log = rootLogger, label = "background task" } = {}
) {
    const task = new Promise((resolve) => setImmediate(resolve))
        .then(work)
        .catch((error) => {
            log.error({ err: error, task: label }, "background task failed");
        })
        .finally(() => running.delete(task));
    running.add(task);
}

/** Resolves when every task started with `runInBackground` has finished (including tasks they start). */
export async function whenBackgroundIdle() {
    while (running.size > 0) await Promise.allSettled([...running]);
}
