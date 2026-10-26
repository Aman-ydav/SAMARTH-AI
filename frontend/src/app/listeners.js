import { isAnyOf } from "@reduxjs/toolkit";
import { resetApp } from "@/app/actions";
import { i18n } from "@/i18n";
import {
    acceptInvite,
    deleteAccount,
    fetchCurrentUser,
    loginUser,
    loginWithGoogle,
    logoutAllDevices,
    logoutUser,
    removeAvatar,
    revokeSession,
    sessionExpired,
    undoEmailChange,
    updateProfile,
    uploadAvatar,
    userPatched,
    verifyEmail,
} from "@/features/auth";
import {
    languageChanged,
    languageSynced,
    sidebarSet,
    sidebarToggled,
    themeChanged,
} from "@/features/preferences";
import { authChannel } from "@/lib/authChannel";
import { isSupportedLanguage } from "@/lib/format";
import { PATHS } from "@/lib/paths";
import { returnState } from "@/lib/safeRedirect";
import { storage } from "@/lib/storage";

/*
 * Router access for listeners. The router never imports the store (FE-65), so bootstrap injects
 * `navigate` and `getLocation` after both exist. Without a bridge (tests, SSR) navigation is skipped.
 */
let bridge = { navigate: null, getLocation: null };

export function setRouterBridge(next) {
    bridge = { navigate: null, getLocation: null, ...next };
}

const navigateTo = (to, options) => bridge.navigate?.(to, options);

const SIGN_IN_ACTIONS = isAnyOf(
    loginUser.fulfilled,
    loginWithGoogle.fulfilled,
    verifyEmail.fulfilled,
    acceptInvite.fulfilled
);
const SIGN_OUT_ACTIONS = isAnyOf(
    logoutUser.fulfilled,
    logoutAllDevices.fulfilled,
    deleteAccount.fulfilled
);
const USER_HYDRATED = isAnyOf(
    fetchCurrentUser.fulfilled,
    loginUser.fulfilled,
    loginWithGoogle.fulfilled,
    verifyEmail.fulfilled,
    acceptInvite.fulfilled
);

function endSessionLocally(api) {
    authChannel.post("logout");
    api.dispatch(resetApp());
    navigateTo(PATHS.login, { replace: true });
}

const PROFILE_CHANGED = isAnyOf(
    updateProfile.fulfilled,
    uploadAvatar.fulfilled,
    removeAvatar.fulfilled
);

/** Cross-slice and non-Redux side effects (FE-13). Listeners never block. */
export function registerListeners(startListening) {
    startListening({
        actionCreator: themeChanged,
        effect: (action, api) => {
            storage.set("sai-theme", api.getState().ui.theme);
        },
    });

    startListening({
        actionCreator: languageChanged,
        effect: (action, api) => {
            storage.set("sai-lang", api.getState().ui.language);
        },
    });

    startListening({
        matcher: isAnyOf(languageChanged, languageSynced),
        effect: (action, api) => {
            const { language } = api.getState().ui;
            if (i18n.language !== language) i18n.changeLanguage(language);
        },
    });

    startListening({
        matcher: isAnyOf(sidebarToggled, sidebarSet),
        effect: (action, api) => {
            storage.set(
                "sai-sidebar",
                api.getState().ui.sidebarCollapsed ? "collapsed" : "expanded"
            );
        },
    });

    /* Language order (FE-82): persisted choice, then the signed-in user's setting, then the browser. */
    startListening({
        matcher: USER_HYDRATED,
        effect: (action, api) => {
            const locale = action.payload?.user?.locale;
            if (storage.get("sai-lang") === null && isSupportedLanguage(locale))
                api.dispatch(languageSynced(locale));
        },
    });

    startListening({
        matcher: SIGN_IN_ACTIONS,
        effect: () => {
            authChannel.post("login");
        },
    });

    startListening({
        matcher: SIGN_OUT_ACTIONS,
        effect: (action, api) => endSessionLocally(api),
    });

    /* Profile and avatar calls answer the fresh user summary: merge it into the auth user so name, language and photo stay current. */
    startListening({
        matcher: PROFILE_CHANGED,
        effect: (action, api) => {
            if (action.payload?.user)
                api.dispatch(userPatched(action.payload.user));
        },
    });

    /* Undoing an email change revokes every session of the account (R38): this tab's session is over too, without a redirect (the page explains). */
    startListening({
        actionCreator: undoEmailChange.fulfilled,
        effect: (action, api) => {
            if (!api.getOriginalState().auth.user) return;
            authChannel.post("logout");
            api.dispatch(resetApp());
        },
    });

    /* Revoking the session you are using acts as logout (doc 08 #20). */
    startListening({
        actionCreator: revokeSession.fulfilled,
        effect: (action, api) => {
            if (action.payload.wasCurrent) endSessionLocally(api);
        },
    });

    /* One path for every session end (FE-58): reset, then /session-expired with a safe return path. A storm of events is deduped by requiring a signed-in user before the action. */
    startListening({
        actionCreator: sessionExpired,
        effect: (action, api) => {
            if (!api.getOriginalState().auth.user) return;
            const state = returnState(bridge.getLocation?.());
            api.dispatch(resetApp());
            navigateTo(PATHS.sessionExpired, {
                replace: true,
                ...(state ? { state } : {}),
            });
        },
    });
}
