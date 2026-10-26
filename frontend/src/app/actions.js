import { createAction } from "@reduxjs/toolkit";

/**
 * Wipes every slice except `ui` and leaves `auth` anonymous but bootstrapped (FE-12).
 * Dispatched on logout, logout-all, session expiry, other-tab logout and account deletion.
 */
export const resetApp = createAction("app/resetApp");
