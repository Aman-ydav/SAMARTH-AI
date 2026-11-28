import { NOTIFICATION_TYPES } from "#constants/notificationTypes.js";
import { eventBus as defaultBus } from "#events/eventBus.js";
import { JOB_EVENTS } from "#events/job.events.js";
import { notify } from "./notify.service.js";

/** Which domain event becomes which notification type. A new trigger adds one line here and one type in the constants. */
const EVENT_TO_TYPE = Object.freeze({
    [JOB_EVENTS.COMPLETED]: NOTIFICATION_TYPES.JOB_COMPLETED,
    [JOB_EVENTS.FAILED]: NOTIFICATION_TYPES.JOB_FAILED,
});

/**
 * Subscribes to the domain events and turns each into a notification for the person it concerns. A finished job
 * notifies its owner; a system job has no owner and notifies nobody. The dedupe key (type plus job id) makes a
 * re-delivered event harmless. A failing `send` is logged by the bus and never reaches the code that emitted (BE-51).
 * Called from `index.js` only, so tests and Supertest never subscribe.
 *
 * @param {{ bus?: { on: Function }, send?: Function }} [options] injectable for tests
 * @returns {() => void} unsubscribes every listener
 */
export function registerNotificationListeners({
    bus = defaultBus,
    send = notify,
} = {}) {
    const unsubscribers = Object.entries(EVENT_TO_TYPE).map(([event, type]) =>
        bus.on(event, async (payload) => {
            if (!payload.ownerId || !payload.orgId) return;
            await send({
                userId: payload.ownerId,
                orgId: payload.orgId,
                type,
                subject: payload.type,
                refId: payload.jobId,
                dedupeKey: `${type}:${payload.jobId}`,
            });
        })
    );
    return () => {
        for (const unsubscribe of unsubscribers) unsubscribe();
    };
}
