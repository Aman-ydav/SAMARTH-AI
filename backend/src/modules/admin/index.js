/**
 * Public API of the admin module (FS-42): the `/admin` router factory (mounted in app.js) and the platform-admin sync
 * that `src/index.js` runs on every start and `npm run seed` runs by hand.
 */
export { createAdminRouter } from "./admin.routes.js";
export { syncPlatformAdmins, SYNC_OUTCOMES } from "./platformAdmins.service.js";
