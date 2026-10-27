import { describe, expect, it } from "vitest";
import { AUDIT_ACTION_LIST, AUDIT_ACTIONS } from "./auditActions.js";

describe("AUDIT_ACTIONS (AUTH-63, doc 20 section 14)", () => {
    it("maps every name to itself and includes every action AUTH-63 requires", () => {
        for (const [key, value] of Object.entries(AUDIT_ACTIONS))
            expect(value).toBe(key);
        for (const required of [
            "USER_REGISTERED",
            "EMAIL_VERIFIED",
            "LOGIN_SUCCESS",
            "LOGIN_FAILED",
            "LOGIN_NEW_DEVICE",
            "ACCOUNT_LOCKED",
            "PASSWORD_RESET_REQUESTED",
            "PASSWORD_RESET_COMPLETED",
            "PASSWORD_CHANGED",
            "EMAIL_CHANGED",
            "GOOGLE_LINKED",
            "GOOGLE_UNLINKED",
            "SESSION_REVOKED",
            "LOGOUT_ALL",
            "TOKEN_REUSE_DETECTED",
            "ROLE_CHANGED",
            "INVITE_REVOKED",
            "INVITE_RESENT",
            "PLATFORM_ADMIN_CREATED",
        ]) {
            expect(AUDIT_ACTION_LIST).toContain(required);
        }
    });

    it("has no duplicates and is frozen", () => {
        expect(new Set(AUDIT_ACTION_LIST).size).toBe(AUDIT_ACTION_LIST.length);
        expect(Object.isFrozen(AUDIT_ACTIONS)).toBe(true);
    });
});
