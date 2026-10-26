import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsSessionsPage from "@/features/auth/pages/SettingsSessionsPage";
import { i18n } from "@/i18n";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { makeSession } from "@/mocks/fixtures/session";
import { signedInAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { renderPage } from "@/test/pageHarness";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const server = setupMockServer();
const sessionsUrl = apiUrl("/auth/sessions");
const FIREFOX = "64b7f0c2a1b2c3d4e5f60102";
const SAFARI = "64b7f0c2a1b2c3d4e5f60103";

const threeDevices = () => [
    makeSession(),
    makeSession({
        id: FIREFOX,
        device: "Firefox on Linux",
        current: false,
        lastUsedAt: "2026-10-25T09:00:00.000Z",
    }),
    makeSession({
        id: SAFARI,
        device: "Safari on iPhone",
        current: false,
        lastUsedAt: "2026-10-20T09:00:00.000Z",
    }),
];

beforeEach(() => {
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
});
afterEach(async () => {
    await i18n.changeLanguage("en");
});

function renderSessions() {
    return renderPage(SettingsSessionsPage, {
        path: "/settings/sessions",
        preloadedState: { auth: signedInAuth() },
    });
}

const useSessions = (list) =>
    server.use(http.get(sessionsUrl, () => okResponse(list)));

function trackRevokes(response = () => okResponse(null)) {
    const ids = [];
    server.use(
        http.delete(apiUrl("/auth/sessions/:id"), ({ params }) => {
            ids.push(params.id);
            return response();
        })
    );
    return ids;
}

describe("SettingsSessionsPage list", () => {
    it("shows a loading status, then the devices with the current one marked", async () => {
        useSessions(threeDevices());
        const { container } = renderSessions();
        expect(screen.getByRole("status")).toHaveAccessibleName(
            "Loading your settings…"
        );
        const list = await screen.findByRole("list", {
            name: "Devices where you are logged in",
        });
        const items = within(list).getAllByRole("listitem");
        expect(items).toHaveLength(3);
        expect(within(items[0]).getByText("Chrome on Windows")).toBeVisible();
        expect(within(items[0]).getByText("This device")).toBeVisible();
        expect(within(items[0]).queryByRole("button")).not.toBeInTheDocument();
        expect(within(items[1]).getByText("Firefox on Linux")).toBeVisible();
        expect(within(items[1]).getByText(/Last active/)).toBeVisible();
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "Devices and sessions",
            })
        ).toBeInTheDocument();
        expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
        await expectAccessible(container);
    });

    it("links the settings sections and marks the current one", async () => {
        useSessions(threeDevices());
        renderSessions();
        await screen.findByRole("list", { name: /Devices/ });
        const nav = screen.getByRole("navigation", {
            name: "Account settings sections",
        });
        expect(
            within(nav).getByRole("link", { name: "Devices" })
        ).toHaveAttribute("aria-current", "page");
        expect(
            within(nav).getByRole("link", { name: "Security" })
        ).toHaveAttribute("href", "/settings/security");
        expect(
            within(nav).getByRole("link", { name: "Profile" })
        ).not.toHaveAttribute("aria-current");
    });

    it("explains the 10 device limit", async () => {
        useSessions(threeDevices());
        renderSessions();
        expect(await screen.findByText(/up to 10 devices/)).toBeVisible();
    });

    it("handles a device with no name or times", async () => {
        useSessions([
            makeSession({
                device: "",
                lastUsedAt: null,
                createdAt: null,
            }),
        ]);
        renderSessions();
        expect(await screen.findByText("Unknown device")).toBeVisible();
        expect(screen.queryByText(/Last active/)).not.toBeInTheDocument();
    });

    it("shows an empty state when the server returns no devices", async () => {
        useSessions([]);
        const { container } = renderSessions();
        expect(await screen.findByText("No sessions to show")).toBeVisible();
        await expectAccessible(container);
    });

    it("shows the error with a request id for 5xx and retries", async () => {
        let calls = 0;
        server.use(
            http.get(sessionsUrl, () => {
                calls += 1;
                return calls === 1
                    ? errorResponse(500, "INTERNAL", { requestId: "req-sess" })
                    : okResponse(threeDevices());
            })
        );
        const user = userEvent.setup();
        renderSessions();
        expect(
            await screen.findByText(/Something went wrong on our side/)
        ).toBeVisible();
        expect(screen.getByText(/req-sess/)).toBeVisible();
        await user.click(screen.getByRole("button", { name: "Try again" }));
        expect(await screen.findByText("Firefox on Linux")).toBeVisible();
    });
});

describe("revoking one device", () => {
    it("asks first and does nothing when cancelled", async () => {
        useSessions(threeDevices());
        const ids = trackRevokes();
        const user = userEvent.setup();
        renderSessions();
        await user.click(
            await screen.findByRole("button", {
                name: "Log out Firefox on Linux",
            })
        );
        const dialog = await screen.findByRole("alertdialog");
        expect(
            within(dialog).getByText(/Firefox on Linux will be logged out/)
        ).toBeVisible();
        await user.click(
            within(dialog).getByRole("button", { name: "Cancel" })
        );
        await waitFor(() =>
            expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
        );
        expect(ids).toEqual([]);
        expect(screen.getByText("Firefox on Linux")).toBeVisible();
    });

    it("revokes after confirming, removes the row and toasts", async () => {
        useSessions(threeDevices());
        const ids = trackRevokes();
        const user = userEvent.setup();
        renderSessions();
        await user.click(
            await screen.findByRole("button", {
                name: "Log out Firefox on Linux",
            })
        );
        await user.click(
            within(await screen.findByRole("alertdialog")).getByRole("button", {
                name: "Log out device",
            })
        );
        await waitFor(() =>
            expect(
                screen.queryByText("Firefox on Linux")
            ).not.toBeInTheDocument()
        );
        expect(ids).toEqual([FIREFOX]);
        expect(toast.success).toHaveBeenCalledWith(
            "Device logged out.",
            expect.objectContaining({ id: `sessions-${FIREFOX}` })
        );
        expect(screen.getByText("Safari on iPhone")).toBeVisible();
    });

    it("refreshes the list quietly when the session is already gone (404)", async () => {
        let listCalls = 0;
        server.use(
            http.get(sessionsUrl, () => {
                listCalls += 1;
                return okResponse(
                    listCalls === 1 ? threeDevices() : [makeSession()]
                );
            })
        );
        trackRevokes(() => errorResponse(404, "NOT_FOUND"));
        const user = userEvent.setup();
        renderSessions();
        await user.click(
            await screen.findByRole("button", {
                name: "Log out Firefox on Linux",
            })
        );
        await user.click(
            within(await screen.findByRole("alertdialog")).getByRole("button", {
                name: "Log out device",
            })
        );
        await waitFor(() =>
            expect(
                screen.queryByText("Firefox on Linux")
            ).not.toBeInTheDocument()
        );
        expect(toast.error).not.toHaveBeenCalled();
    });

    it("keeps the row and shows an error toast when the server fails", async () => {
        useSessions(threeDevices());
        trackRevokes(() => errorResponse(500, "INTERNAL"));
        const user = userEvent.setup();
        renderSessions();
        await user.click(
            await screen.findByRole("button", {
                name: "Log out Firefox on Linux",
            })
        );
        await user.click(
            within(await screen.findByRole("alertdialog")).getByRole("button", {
                name: "Log out device",
            })
        );
        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                "Something went wrong on our side. Please try again.",
                expect.any(Object)
            )
        );
        expect(await screen.findByText("Firefox on Linux")).toBeVisible();
    });
});

describe("revoking other devices and logging out everywhere", () => {
    it("revokes every other device after confirming and keeps this one", async () => {
        useSessions(threeDevices());
        const ids = trackRevokes();
        const user = userEvent.setup();
        renderSessions();
        await user.click(
            await screen.findByRole("button", {
                name: "Log out other devices",
            })
        );
        const dialog = await screen.findByRole("alertdialog");
        await user.click(
            within(dialog).getByRole("button", {
                name: "Log out other devices",
            })
        );
        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith(
                "Other devices logged out.",
                expect.any(Object)
            )
        );
        expect(ids.sort()).toEqual([FIREFOX, SAFARI].sort());
        expect(screen.getByText("Chrome on Windows")).toBeVisible();
        expect(screen.queryByText("Firefox on Linux")).not.toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Log out other devices" })
        ).not.toBeInTheDocument();
    });

    it("hides the others button when this is the only device", async () => {
        useSessions([makeSession()]);
        renderSessions();
        await screen.findByText("Chrome on Windows");
        expect(
            screen.queryByRole("button", { name: "Log out other devices" })
        ).not.toBeInTheDocument();
    });

    it("logs out of all devices after confirming and goes to the log in page", async () => {
        useSessions(threeDevices());
        const user = userEvent.setup();
        const { router, store } = renderSessions();
        await user.click(
            await screen.findByRole("button", {
                name: "Log out of all devices",
            })
        );
        await user.click(
            within(await screen.findByRole("alertdialog")).getByRole("button", {
                name: "Log out everywhere",
            })
        );
        await waitFor(() =>
            expect(router.state.location.pathname).toBe("/login")
        );
        expect(store.getState().auth.user).toBeNull();
    });
});

describe("SettingsSessionsPage Hindi", () => {
    it("renders in Hindi without accessibility violations", async () => {
        await i18n.changeLanguage("hi");
        useSessions(threeDevices());
        const { container } = renderSessions();
        expect(
            await screen.findByRole("heading", {
                level: 1,
                name: "डिवाइस और सत्र",
            })
        ).toBeInTheDocument();
        expect(await screen.findByText("यह डिवाइस")).toBeVisible();
        await expectAccessible(container);
    });
});
