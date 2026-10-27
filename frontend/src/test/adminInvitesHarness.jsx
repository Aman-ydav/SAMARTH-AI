import { http } from "msw";
import { afterEach, beforeEach, vi } from "vitest";
import { toast } from "sonner";
import AdminInvitesPage from "@/features/admin/pages/AdminInvitesPage";
import { i18n } from "@/i18n";
import { server } from "@/mocks/server";
import { apiUrl, okResponse, pageMeta } from "@/mocks/fixtures/envelope";
import { makeInvite } from "@/mocks/fixtures/invite";
import { signedInAuth } from "@/test/authState";
import { renderPage } from "@/test/pageHarness";

/* Shared setup of the invitation screen tests (AdminInvitesPage, InviteForm, InvitesList). Each test file still declares
   the `sonner` mock itself because vi.mock is hoisted per file. */
export const invitesUrl = apiUrl("/admin/invites");
export const INVITE_ID = "64b7f0c2a1b2c3d4e5f60201";

/** Clears the toast spies before and restores English after every test of the calling file. */
export function registerAdminTestHooks() {
    beforeEach(() => {
        vi.mocked(toast.success).mockClear();
        vi.mocked(toast.error).mockClear();
    });
    afterEach(async () => {
        await i18n.changeLanguage("en");
    });
}

export function renderInvites({
    role = "admin",
    entry = "/admin/invites",
} = {}) {
    return renderPage(AdminInvitesPage, {
        path: "/admin/invites",
        entry,
        preloadedState: { auth: signedInAuth({ role }) },
    });
}

export const useList = (invites, total = invites.length, meta = {}) =>
    server.use(
        http.get(invitesUrl, () =>
            okResponse({ invites }, { meta: pageMeta({ total, ...meta }) })
        )
    );

export const sentInvites = () => [
    makeInvite(),
    makeInvite({
        id: "i2",
        email: "old.one@example.test",
        status: "accepted",
        role: "admin",
    }),
    makeInvite({
        id: "i3",
        email: "late.one@example.test",
        status: "expired",
        resentCount: 5,
    }),
];
