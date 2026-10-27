import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { http } from "msw";
import { afterEach, beforeEach, vi } from "vitest";
import { toast } from "sonner";
import AdminUsersPage from "@/features/admin/pages/AdminUsersPage";
import { i18n } from "@/i18n";
import { makeAdminUser } from "@/mocks/fixtures/adminUser";
import { apiUrl, okResponse, pageMeta } from "@/mocks/fixtures/envelope";
import { makeUser } from "@/mocks/fixtures/user";
import { server } from "@/mocks/server";
import { signedInAuth } from "@/test/authState";
import { renderPage } from "@/test/pageHarness";

/* Shared setup of the accounts screen tests (AdminUsersPage, UsersList, UserActionsMenu, RoleChangeDialog). Each test file
   still declares the `sonner` mock itself because vi.mock is hoisted per file. */
export const usersUrl = apiUrl("/admin/users");
export const SELF_ID = makeUser().id;
export const LEARNER = "64b7f0c2a1b2c3d4e5f60301";
export const TRAINER = "64b7f0c2a1b2c3d4e5f60302";
export const ADMIN = "64b7f0c2a1b2c3d4e5f60303";
export const PLATFORM = "64b7f0c2a1b2c3d4e5f60304";
export const SUSPENDED = "64b7f0c2a1b2c3d4e5f60305";
export const PENDING = "64b7f0c2a1b2c3d4e5f60306";

export const accounts = () => [
    makeAdminUser({
        id: LEARNER,
        name: "Ravi Kumar",
        email: "ravi@example.test",
    }),
    makeAdminUser({
        id: TRAINER,
        name: "Tara Singh",
        email: "tara@example.test",
        role: "trainer",
    }),
    makeAdminUser({
        id: ADMIN,
        name: "Anil Rao",
        email: "anil@example.test",
        role: "admin",
    }),
    makeAdminUser({
        id: PLATFORM,
        name: "Priya Root",
        email: "priya@example.test",
        role: "superadmin",
    }),
    makeAdminUser({
        id: SUSPENDED,
        name: "Sunil Das",
        email: "sunil@example.test",
        status: "suspended",
    }),
    makeAdminUser({
        id: PENDING,
        name: "Nina Paul",
        email: "nina@example.test",
        status: "pending_verification",
    }),
    makeAdminUser({
        id: SELF_ID,
        name: "Asha Verma",
        email: "asha.verma@example.test",
        role: "admin",
    }),
];

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

export function renderUsers({ role = "admin", entry = "/admin/users" } = {}) {
    return renderPage(AdminUsersPage, {
        path: "/admin/users",
        entry,
        preloadedState: { auth: signedInAuth({ role }) },
    });
}

export const useList = (users, total = users.length) =>
    server.use(
        http.get(usersUrl, () =>
            okResponse({ users }, { meta: pageMeta({ total }) })
        )
    );

export const rowOf = (name) => screen.getByText(name).closest("tr");
export const menuOf = (name) =>
    screen.queryByRole("button", { name: `Actions for ${name}` });

export async function openMenu(name) {
    await userEvent.click(menuOf(name));
    return screen.findByRole("menu");
}
