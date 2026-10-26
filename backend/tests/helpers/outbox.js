import { tokenOf } from "#integrations/email/memory.adapter.js";

/**
 * Helpers over the memory email transport (TEST-24). Pass the service from `buildApp()` or the default `emailService`.
 * Always `await service.whenSettled()` first when the code under test used `enqueueEmail`.
 */
export const sentTo = (service, to, templateKey) =>
    service.outbox.find({ to, templateKey });

export const latestEmail = (service, to, templateKey) =>
    service.outbox.latest({ to, templateKey });

/** The one-time token in the newest matching email (taken from the link fragment), or null. */
export const latestToken = (service, to, templateKey) =>
    tokenOf(latestEmail(service, to, templateKey));

export const clearOutbox = (service) => service.outbox.clear();
