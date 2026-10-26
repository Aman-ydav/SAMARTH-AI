import { describe, expect, it } from "vitest";
import * as statuses from "./statuses.js";

describe("status enums", () => {
    it("USER_STATUSES matches rule 05 (doc 20 section 2)", () => {
        expect(statuses.USER_STATUS_LIST).toEqual([
            "invited",
            "pending_verification",
            "active",
            "suspended",
            "deactivated",
            "pending_deletion",
            "deleted",
        ]);
    });

    it("keeps values lower_snake_case and every list frozen (DB-03)", () => {
        for (const [name, value] of Object.entries(statuses)) {
            if (!name.endsWith("_LIST")) continue;
            expect(Object.isFrozen(value)).toBe(true);
            for (const item of value)
                expect(item).toMatch(/^[a-z]+(_[a-z]+)*$/);
        }
    });

    it("covers sessions, invites, providers, locales and media statuses", () => {
        expect(statuses.SESSION_REVOKED_REASON_LIST).toContain(
            "reuse_detected"
        );
        expect(statuses.INVITE_STATUS_LIST).toEqual([
            "sent",
            "accepted",
            "revoked",
            "expired",
        ]);
        expect(statuses.AUTH_PROVIDER_LIST).toEqual(["local", "google", "sso"]);
        expect(statuses.LOCALE_LIST).toEqual(["en", "hi"]);
        expect(statuses.MEDIA_STATUS_LIST).toEqual([
            "pending",
            "ready",
            "deleted",
        ]);
    });
});
