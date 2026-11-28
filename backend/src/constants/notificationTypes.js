/**
 * In-app notification types (doc 22 section 2, DB-03). Values are lowercase dotted codes. The client builds the
 * localized text from the type (`notifications:types.<type>`), so the server never stores rendered English or Hindi.
 * Add a type here in the same task that adds its trigger.
 */
export const NOTIFICATION_TYPES = Object.freeze({
    JOB_COMPLETED: "job.completed",
    JOB_FAILED: "job.failed",
});
export const NOTIFICATION_TYPE_LIST = Object.freeze(
    Object.values(NOTIFICATION_TYPES)
);
