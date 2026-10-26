import { http } from "msw";
import { describe, expect, it, vi } from "vitest";
import * as profileApi from "@/features/auth/api/profileApi";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { makeUser } from "@/mocks/fixtures/user";
import { setupMockServer } from "@/test/mockServerLifecycle";

const server = setupMockServer();
const png = () =>
    new File([new Uint8Array(2048)], "me.png", { type: "image/png" });

describe("readProfileUser", () => {
    it("splits the time zone from the user summary", () => {
        const result = profileApi.readProfileUser({
            user: { ...makeUser(), timezone: "Asia/Kolkata" },
        });
        expect(result.timezone).toBe("Asia/Kolkata");
        expect(result.user.timezone).toBeUndefined();
        expect(result.user.email).toBe("asha.verma@example.test");
    });

    it("gives a null time zone when the answer has none", () => {
        expect(
            profileApi.readProfileUser({ user: makeUser() }).timezone
        ).toBeNull();
        expect(
            profileApi.readProfileUser({ user: { ...makeUser(), timezone: 5 } })
                .timezone
        ).toBeNull();
    });

    it.each([undefined, null, {}, { user: null }, { user: "x" }])(
        "returns null for %j",
        (data) => {
            expect(profileApi.readProfileUser(data)).toBeNull();
        }
    );
});

describe("profileApi requests", () => {
    it("getProfile and updateProfile unwrap the envelope data", async () => {
        let body;
        server.use(
            http.get(apiUrl("/profile"), () =>
                okResponse({ user: { ...makeUser(), timezone: "UTC" } })
            ),
            http.put(apiUrl("/profile"), async ({ request }) => {
                body = await request.json();
                return okResponse({ user: makeUser({ name: "New Name" }) });
            })
        );
        expect((await profileApi.getProfile()).user.timezone).toBe("UTC");
        const updated = await profileApi.updateProfile({ name: "New Name" });
        expect(body).toEqual({ name: "New Name" });
        expect(updated.user.name).toBe("New Name");
    });

    it("uploadAvatar sends multipart with the CSRF header and reports upload progress", async () => {
        document.cookie = "sai_csrf=csrf-api-test";
        let headers;
        server.use(
            http.put(apiUrl("/me/avatar"), ({ request }) => {
                headers = request.headers;
                return okResponse({ user: makeUser() });
            })
        );
        const onProgress = vi.fn();
        await profileApi.uploadAvatar({ file: png() }, { onProgress });
        expect(headers.get("x-csrf-token")).toBe("csrf-api-test");
        expect(headers.get("content-type")).toMatch(/^multipart\/form-data/);
        expect(onProgress).toHaveBeenCalled();
        for (const [percent] of onProgress.mock.calls) {
            expect(percent).toBeGreaterThanOrEqual(0);
            expect(percent).toBeLessThanOrEqual(100);
        }
        document.cookie = "sai_csrf=; Max-Age=0";
    });

    it("uploadAvatar works without a progress callback", async () => {
        server.use(
            http.put(apiUrl("/me/avatar"), () =>
                okResponse({ user: makeUser() })
            )
        );
        const data = await profileApi.uploadAvatar({ file: png() });
        expect(data.user.id).toBeTruthy();
    });

    it("removeAvatar sends DELETE and returns the user summary", async () => {
        server.use(
            http.delete(apiUrl("/me/avatar"), () =>
                okResponse({ user: makeUser({ avatar: null }) })
            )
        );
        expect((await profileApi.removeAvatar()).user.avatar).toBeNull();
    });

    it("rejects with a normalised ApiError carrying the server code", async () => {
        server.use(
            http.put(apiUrl("/me/avatar"), () =>
                errorResponse(413, "FILE_TOO_LARGE")
            )
        );
        await expect(
            profileApi.uploadAvatar({ file: png() })
        ).rejects.toMatchObject({
            statusCode: 413,
            code: "FILE_TOO_LARGE",
        });
    });
});
