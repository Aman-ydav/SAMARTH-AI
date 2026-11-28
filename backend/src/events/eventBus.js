import { logger as rootLogger } from "#utils/logger.js";
import { JOB_EVENTS } from "./job.events.js";

/** Every event name the bus accepts. A new `<topic>.events.js` file adds its names here: an unknown name is a bug. */
export const EVENT_NAMES = Object.freeze([...Object.values(JOB_EVENTS)]);

/**
 * Builds an in-process, typed event bus. Listeners run for their side effects only: a listener that throws or rejects
 * is logged and never stops the other listeners or the code that emitted (BE-51: side effects stay off the request).
 * The bus lives inside one Node process; it is not a message queue, so anything that must survive a restart goes
 * through a job instead.
 *
 * @param {object} [options]
 * @param {readonly string[]} [options.knownEvents] accepted event names (tests pass their own)
 * @param {{ error: Function }} [options.log] pino logger
 */
export function createEventBus({
    knownEvents = EVENT_NAMES,
    log = rootLogger,
} = {}) {
    const known = new Set(knownEvents);
    const listeners = new Map();

    const assertKnown = (name) => {
        if (!known.has(name)) throw new TypeError(`Unknown event "${name}"`);
    };

    /** Subscribes `listener` to `name`; returns the function that unsubscribes it. */
    function on(name, listener) {
        assertKnown(name);
        if (typeof listener !== "function")
            throw new TypeError("An event listener must be a function");
        const set = listeners.get(name) ?? new Set();
        set.add(listener);
        listeners.set(name, set);
        return () => off(name, listener);
    }

    /** Removes a listener; removing one that is not subscribed does nothing. */
    function off(name, listener) {
        listeners.get(name)?.delete(listener);
    }

    /**
     * Delivers a frozen copy of `payload` to every current listener and waits for all of them.
     * @returns {Promise<{ delivered: number, failed: number }>}
     */
    async function emit(name, payload = {}) {
        assertKnown(name);
        const snapshot = [...(listeners.get(name) ?? [])];
        const frozen = Object.freeze({ ...payload });
        const outcomes = await Promise.allSettled(
            snapshot.map(async (listener) => listener(frozen))
        );
        let failed = 0;
        for (const outcome of outcomes) {
            if (outcome.status === "rejected") {
                failed += 1;
                log.error(
                    { err: outcome.reason, event: name },
                    "event listener failed"
                );
            }
        }
        return { delivered: snapshot.length - failed, failed };
    }

    const listenerCount = (name) => listeners.get(name)?.size ?? 0;
    const clear = () => listeners.clear();

    return Object.freeze({ on, off, emit, listenerCount, clear });
}

/** The process-wide bus the job worker and later notification code share. */
export const eventBus = createEventBus();
