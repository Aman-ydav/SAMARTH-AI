import { combineReducers } from "@reduxjs/toolkit";
import { resetApp } from "@/app/actions";
import {
    accountReducer,
    authInitialState,
    authReducer,
    profileReducer,
    registrationReducer,
    sessionsReducer,
} from "@/features/auth";
import { adminUsersReducer, invitesReducer } from "@/features/admin";
import { uiReducer } from "@/features/preferences";

const appReducer = combineReducers({
    auth: authReducer,
    account: accountReducer,
    profile: profileReducer,
    registration: registrationReducer,
    sessions: sessionsReducer,
    invites: invitesReducer,
    adminUsers: adminUsersReducer,
    ui: uiReducer,
});

/** Root reducer with the `resetApp` wipe: no data of a previous user survives (FE-12). */
export function rootReducer(state, action) {
    if (resetApp.match(action)) {
        const anonymous = {
            ...authInitialState,
            bootstrapped: true,
            sessionEnd: state?.auth?.sessionEnd ?? null,
        };
        return appReducer({ ui: state?.ui, auth: anonymous }, action);
    }
    return appReducer(state, action);
}
