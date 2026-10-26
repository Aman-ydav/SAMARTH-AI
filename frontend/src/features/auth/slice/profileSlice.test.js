import { http } from "msw";
import { describe, expect, it } from "vitest";
import { resetApp } from "@/app/actions";
import { setupStore } from "@/app/store";
import {
    avatarProgressed,
    fetchProfile,
    profileInitialState,
    profileOpCleared,
    removeAvatar,
    selectAvatarProgress,
    selectProfileError,
    selectProfileOp,
    selectProfileStatus,
    selectProfileTimezone,
    updateProfile,
    uploadAvatar,
} from "@/features/auth";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { makeUser } from "@/mocks/fixtures/user";
import { signedInAuth } from "@/test/authState";
import { setupMockServer } from "@/test/mockServerLifecycle";

const server = setupMockServer();
const profileUrl = apiUrl("/profile");
const avatarUrl = apiUrl("/me/avatar");
const png = () =>
    new File([new Uint8Array([1, 2, 3])], "me.png", { type: "image/png" });
const withTimezone = (overrides = {}) => ({
    user: { ...makeUser(overrides), timezone: "Asia/Kolkata" },
});

const makeStore = () => setupStore({ auth: signedInAuth() });

describe("profile slice initial state", () => {
    it("follows the async state shape with a null time zone", () => {
        expect(makeStore().getState().profile).toEqual(profileInitialState);
        expect(profileInitialState).toMatchObject({
            status: "idle",
            error: null,
            lastFetchedAt: null,
            timezone: null,
            avatarProgress: 0,
        });
    });
});

describe("fetchProfile", () => {
    it("loads the time zone and keeps it out of the user summary", async () => {
        const store = makeStore();
        const pending = store.dispatch(fetchProfile());
        expect(selectProfileStatus(store.getState())).toBe("loading");
        const action = await pending;
        expect(selectProfileTimezone(store.getState())).toBe("Asia/Kolkata");
        expect(selectProfileStatus(store.getState())).toBe("succeeded");
        expect(store.getState().profile.lastFetchedAt).toEqual(
            expect.any(Number)
        );
        expect(action.payload.user.timezone).toBeUndefined();
    });

    it("dedupes while loading and skips a fresh copy unless forced", async () => {
        let calls = 0;
        server.use(
            http.get(profileUrl, () => {
                calls += 1;
                return okResponse(withTimezone());
            })
        );
        const store = makeStore();
        await Promise.all([
            store.dispatch(fetchProfile()),
            store.dispatch(fetchProfile()),
        ]);
        expect(calls).toBe(1);
        await store.dispatch(fetchProfile());
        expect(calls).toBe(1);
        await store.dispatch(fetchProfile({ force: true }));
        expect(calls).toBe(2);
    });

    it("rejects an answer without a user as INVALID_RESPONSE", async () => {
        server.use(http.get(profileUrl, () => okResponse({})));
        const store = makeStore();
        await store.dispatch(fetchProfile());
        expect(selectProfileStatus(store.getState())).toBe("failed");
        expect(selectProfileError(store.getState()).code).toBe(
            "INVALID_RESPONSE"
        );
    });

    it("stores a failure and recovers on a retry", async () => {
        server.use(
            http.get(profileUrl, () => errorResponse(500, "INTERNAL"), {
                once: true,
            })
        );
        const store = makeStore();
        await store.dispatch(fetchProfile());
        expect(selectProfileStatus(store.getState())).toBe("failed");
        expect(selectProfileError(store.getState())).toMatchObject({
            statusCode: 500,
            code: "INTERNAL",
        });
        await store.dispatch(fetchProfile());
        expect(selectProfileStatus(store.getState())).toBe("succeeded");
        expect(selectProfileError(store.getState())).toBeNull();
    });

    it("treats an aborted read as idle, not as a failure", async () => {
        server.use(
            http.get(profileUrl, async () => {
                await new Promise((resolve) => setTimeout(resolve, 20));
                return okResponse(withTimezone());
            })
        );
        const store = makeStore();
        const pending = store.dispatch(fetchProfile());
        pending.abort();
        await pending;
        expect(selectProfileStatus(store.getState())).toBe("idle");
        expect(selectProfileError(store.getState())).toBeNull();
    });
});

describe("updateProfile", () => {
    it("sends only the given fields and stores the new time zone", async () => {
        let body;
        server.use(
            http.put(profileUrl, async ({ request }) => {
                body = await request.json();
                return okResponse({
                    user: {
                        ...makeUser({ name: "Asha V" }),
                        timezone: "UTC",
                    },
                });
            })
        );
        const store = makeStore();
        const action = await store.dispatch(
            updateProfile({ name: "Asha V", timezone: "UTC" })
        );
        expect(body).toEqual({ name: "Asha V", timezone: "UTC" });
        expect(selectProfileTimezone(store.getState())).toBe("UTC");
        expect(action.payload.user.name).toBe("Asha V");
        expect(selectProfileOp(store.getState(), "updateProfile").status).toBe(
            "succeeded"
        );
    });

    it("keeps the stored time zone when the answer has none", async () => {
        server.use(
            http.put(profileUrl, () => okResponse({ user: makeUser() }))
        );
        const store = makeStore();
        await store.dispatch(fetchProfile());
        await store.dispatch(updateProfile({ name: "New Name" }));
        expect(selectProfileTimezone(store.getState())).toBe("Asia/Kolkata");
    });

    it("records a server refusal on the operation record", async () => {
        server.use(
            http.put(profileUrl, () =>
                errorResponse(400, "VALIDATION_ERROR", {
                    errors: [{ field: "name", message: "Name is required" }],
                })
            )
        );
        const store = makeStore();
        const action = await store.dispatch(updateProfile({ name: "" }));
        expect(action.payload.errors).toEqual([
            { field: "name", message: "Name is required" },
        ]);
        expect(
            selectProfileOp(store.getState(), "updateProfile")
        ).toMatchObject({
            status: "failed",
        });
        store.dispatch(profileOpCleared("updateProfile"));
        expect(selectProfileOp(store.getState(), "updateProfile").status).toBe(
            "idle"
        );
    });

    it("rejects an answer without a user", async () => {
        server.use(http.put(profileUrl, () => okResponse(null)));
        const store = makeStore();
        const action = await store.dispatch(updateProfile({ name: "Asha V" }));
        expect(action.payload.code).toBe("INVALID_RESPONSE");
    });
});

describe("uploadAvatar", () => {
    it("posts the file as multipart field `file` and ends at 100 percent", async () => {
        let contentType;
        let raw;
        let csrfHeaderSeen = false;
        document.cookie = "sai_csrf=csrf-test-value";
        server.use(
            http.put(avatarUrl, async ({ request }) => {
                csrfHeaderSeen =
                    request.headers.get("x-csrf-token") === "csrf-test-value";
                contentType = request.headers.get("content-type");
                raw = await request.text();
                return okResponse({
                    user: makeUser({
                        avatar: {
                            publicId: "samarth-ai/test/avatars/z9",
                            version: 3,
                        },
                    }),
                });
            })
        );
        const store = makeStore();
        const action = await store.dispatch(uploadAvatar({ file: png() }));
        expect(contentType).toMatch(/^multipart\/form-data; boundary=/);
        expect(raw).toContain('name="file"; filename="me.png"');
        expect(raw).toContain("Content-Type: image/png");
        expect(csrfHeaderSeen).toBe(true);
        expect(action.payload.user.avatar.publicId).toBe(
            "samarth-ai/test/avatars/z9"
        );
        expect(selectAvatarProgress(store.getState())).toBe(100);
        document.cookie = "sai_csrf=; Max-Age=0";
    });

    it("resets progress and records the failure when the server refuses", async () => {
        server.use(
            http.put(avatarUrl, () =>
                errorResponse(400, "MEDIA_TYPE_NOT_ALLOWED")
            )
        );
        const store = makeStore();
        store.dispatch(avatarProgressed(60));
        const action = await store.dispatch(uploadAvatar({ file: png() }));
        expect(action.payload.code).toBe("MEDIA_TYPE_NOT_ALLOWED");
        expect(selectAvatarProgress(store.getState())).toBe(0);
        expect(selectProfileOp(store.getState(), "uploadAvatar").status).toBe(
            "failed"
        );
    });

    it("does not store the file anywhere in state", async () => {
        const store = makeStore();
        await store.dispatch(uploadAvatar({ file: png() }));
        expect(JSON.stringify(store.getState())).not.toContain("me.png");
    });

    it("clamps progress values", () => {
        const store = makeStore();
        store.dispatch(avatarProgressed(250));
        expect(selectAvatarProgress(store.getState())).toBe(100);
        store.dispatch(avatarProgressed(-5));
        expect(selectAvatarProgress(store.getState())).toBe(0);
    });
});

describe("removeAvatar", () => {
    it("answers the user summary without an avatar", async () => {
        const store = makeStore();
        const action = await store.dispatch(removeAvatar());
        expect(action.payload.user.avatar).toBeNull();
        expect(selectProfileOp(store.getState(), "removeAvatar").status).toBe(
            "succeeded"
        );
    });

    it("surfaces a failure", async () => {
        server.use(
            http.delete(avatarUrl, () => errorResponse(500, "INTERNAL"))
        );
        const store = makeStore();
        const action = await store.dispatch(removeAvatar());
        expect(action.payload.code).toBe("INTERNAL");
    });
});

describe("resetApp", () => {
    it("wipes the profile so the next user never sees it", async () => {
        const store = makeStore();
        await store.dispatch(fetchProfile());
        store.dispatch(resetApp());
        expect(store.getState().profile).toEqual(profileInitialState);
    });
});
