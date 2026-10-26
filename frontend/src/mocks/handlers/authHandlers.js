import { http } from "msw";
import { apiUrl, okResponse } from "@/mocks/fixtures/envelope";
import { makeSession } from "@/mocks/fixtures/session";
import { makeSessionData, makeUser } from "@/mocks/fixtures/user";

/** Happy-path defaults for every auth endpoint in doc 08 section 3. Tests override single routes with `server.use`. */
export const authHandlers = [
    http.post(apiUrl("/auth/register"), () =>
        okResponse(null, {
            status: 202,
            message:
                "If the address can be registered, a verification email is on its way.",
        })
    ),
    http.post(apiUrl("/auth/verify-email"), () =>
        okResponse(makeSessionData({ needsOnboarding: true }))
    ),
    http.post(apiUrl("/auth/resend-verification"), () =>
        okResponse(null, {
            message:
                "If the address is pending verification, we sent a new link.",
        })
    ),
    http.post(apiUrl("/auth/login"), () => okResponse(makeSessionData())),
    http.post(apiUrl("/auth/google"), () =>
        okResponse(
            makeSessionData(
                {},
                { authProviders: ["google"], hasPassword: false }
            )
        )
    ),
    http.delete(apiUrl("/auth/google"), () =>
        okResponse({ user: makeUser({ authProviders: ["password"] }) })
    ),
    http.post(apiUrl("/auth/refresh"), () => okResponse(null)),
    http.post(apiUrl("/auth/logout"), () => okResponse(null)),
    http.post(apiUrl("/auth/logout-all"), () => okResponse(null)),
    http.get(apiUrl("/auth/me"), () => okResponse({ user: makeUser() })),
    http.post(apiUrl("/auth/forgot-password"), () =>
        okResponse(null, {
            message:
                "If an account exists for that email, we sent a reset link.",
        })
    ),
    http.post(apiUrl("/auth/reset-password/validate"), () =>
        okResponse({ valid: true })
    ),
    http.post(apiUrl("/auth/reset-password"), () =>
        okResponse(null, { message: "Password updated." })
    ),
    http.post(apiUrl("/auth/change-password"), () =>
        okResponse({ user: makeUser() })
    ),
    http.post(apiUrl("/auth/change-email"), () =>
        okResponse(null, { status: 202, message: "Check your new inbox." })
    ),
    /* Real shapes (backend emailChange.service): confirm answers { emailChanged }, undo answers { restored }. */
    http.post(apiUrl("/auth/change-email/confirm"), () =>
        okResponse({ emailChanged: true })
    ),
    http.post(apiUrl("/auth/change-email/undo"), () =>
        okResponse({ restored: true })
    ),
    http.get(apiUrl("/auth/sessions"), () =>
        okResponse([
            makeSession(),
            makeSession({
                id: "64b7f0c2a1b2c3d4e5f60102",
                device: "Firefox on Linux",
                current: false,
                lastUsedAt: "2026-10-25T09:00:00.000Z",
            }),
        ])
    ),
    http.delete(apiUrl("/auth/sessions/:id"), () => okResponse(null)),
    http.delete(apiUrl("/auth/account"), () =>
        okResponse({ graceEndsAt: "2026-11-25T09:00:00.000Z" })
    ),
    http.post(apiUrl("/auth/accept-invite"), () =>
        okResponse(
            makeSessionData({ needsOnboarding: true }, { role: "trainer" })
        )
    ),
];
