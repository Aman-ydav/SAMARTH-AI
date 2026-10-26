import { describe, expect, it, vi } from "vitest";
import { sendSignIn } from "./sessionResponse.js";

describe("sendSignIn", () => {
    it("sets the cookies from the session and sends only the user summary and flags", () => {
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        const ctx = { cookies: { setSessionCookies: vi.fn() } };
        const session = {
            accessToken: "a",
            refreshToken: "r",
            csrfToken: "c",
            remember: true,
        };
        sendSignIn(
            res,
            ctx,
            {
                user: { id: "1" },
                needsOnboarding: false,
                reactivate: false,
                session,
            },
            "Signed in"
        );
        expect(ctx.cookies.setSessionCookies).toHaveBeenCalledWith(
            res,
            session
        );
        expect(res.status).toHaveBeenCalledWith(200);
        const body = res.json.mock.calls[0][0];
        expect(body).toMatchObject({
            statusCode: 200,
            success: true,
            message: "Signed in",
            data: {
                user: { id: "1" },
                needsOnboarding: false,
                reactivate: false,
            },
        });
        expect(JSON.stringify(body)).not.toMatch(
            /"(accessToken|refreshToken|csrfToken)"/
        );
    });
});
