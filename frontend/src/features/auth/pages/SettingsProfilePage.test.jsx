import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import SettingsProfilePage from "@/features/auth/pages/SettingsProfilePage";
import { i18n } from "@/i18n";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { makeUser } from "@/mocks/fixtures/user";
import { signedInAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { renderPage } from "@/test/pageHarness";

/* The time zone select renders about 400 options, which is slow in jsdom under coverage instrumentation. */
vi.setConfig({ testTimeout: 20000 });

const server = setupMockServer();
const profileUrl = apiUrl("/profile");

afterEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage("en");
});

const profileOf = (overrides = {}) =>
    okResponse({
        user: { timezone: "Asia/Kolkata", ...makeUser(overrides) },
    });

function trackUpdates(response) {
    const bodies = [];
    server.use(
        http.put(profileUrl, async ({ request }) => {
            const body = await request.json();
            bodies.push(body);
            return response ? response(body) : profileOf(body);
        })
    );
    return bodies;
}

function renderProfile(userOverrides = {}) {
    return renderPage(SettingsProfilePage, {
        path: "/settings/profile",
        preloadedState: { auth: signedInAuth(userOverrides) },
    });
}

const nameField = () => screen.findByLabelText("Full name");
const saveButton = () => screen.getByRole("button", { name: "Save changes" });

describe("SettingsProfilePage loading and states", () => {
    it("shows a loading status, then the saved details", async () => {
        const { container } = renderProfile();
        expect(screen.getAllByRole("status")[0]).toHaveAccessibleName(
            "Loading your settings…"
        );
        expect(await nameField()).toHaveValue("Asha Verma");
        expect(screen.getByText("asha.verma@example.test")).toBeVisible();
        expect(
            screen.getByRole("combobox", { name: "Language" })
        ).toHaveTextContent("English");
        expect(
            screen.getByRole("combobox", { name: "Time zone" })
        ).toHaveTextContent("Asia/Kolkata");
        expect(
            screen.getByRole("heading", { level: 1, name: "Profile" })
        ).toBeInTheDocument();
        expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
        await expectAccessible(container);
    });

    it("shows an error with a retry when the profile cannot be read, and keeps the photo card", async () => {
        let calls = 0;
        server.use(
            http.get(profileUrl, () => {
                calls += 1;
                return calls === 1
                    ? errorResponse(500, "INTERNAL", { requestId: "req-prof" })
                    : profileOf();
            })
        );
        const user = userEvent.setup();
        renderProfile();
        expect(
            await screen.findByText(/Something went wrong on our side/)
        ).toBeVisible();
        expect(screen.getByText(/req-prof/)).toBeVisible();
        expect(
            screen.getByRole("heading", { name: "Profile photo" })
        ).toBeVisible();
        await user.click(screen.getByRole("button", { name: "Try again" }));
        expect(await nameField()).toHaveValue("Asha Verma");
    });

    it("falls back to English for an unknown saved language", async () => {
        renderProfile({ locale: "fr" });
        await nameField();
        expect(
            screen.getByRole("combobox", { name: "Language" })
        ).toHaveTextContent("English");
    });
});

describe("SettingsProfilePage saving", () => {
    it("keeps Save disabled until something changes", async () => {
        renderProfile();
        await nameField();
        expect(saveButton()).toBeDisabled();
        await userEvent.setup().type(await nameField(), "a");
        expect(saveButton()).toBeEnabled();
    });

    it("sends only the changed field, updates the app user and confirms", async () => {
        const bodies = trackUpdates();
        const user = userEvent.setup();
        const { store } = renderProfile();
        const field = await nameField();
        await user.clear(field);
        await user.type(field, "  Asha K. Verma ");
        await user.click(saveButton());
        expect(await screen.findByText("Profile saved.")).toBeVisible();
        expect(bodies).toEqual([{ name: "Asha K. Verma" }]);
        expect(store.getState().auth.user.name).toBe("Asha K. Verma");
        expect(store.getState().auth.user.timezone).toBeUndefined();
        expect(field).toHaveValue("Asha K. Verma");
        expect(saveButton()).toBeDisabled();
    });

    it("sends nothing when the edit only added whitespace", async () => {
        const bodies = trackUpdates();
        const user = userEvent.setup();
        renderProfile();
        await user.type(await nameField(), "   ");
        await user.click(saveButton());
        await waitFor(() => expect(saveButton()).toBeDisabled());
        expect(bodies).toEqual([]);
        expect(await nameField()).toHaveValue("Asha Verma");
    });

    it("blocks an empty name on the client with a message", async () => {
        const bodies = trackUpdates();
        const user = userEvent.setup();
        renderProfile();
        await user.clear(await nameField());
        await user.click(saveButton());
        expect(await screen.findByText("Enter your full name.")).toBeVisible();
        expect(await nameField()).toHaveAttribute("aria-invalid", "true");
        expect(bodies).toEqual([]);
    });

    it("sends one request for a double click", async () => {
        const bodies = trackUpdates();
        const user = userEvent.setup();
        renderProfile();
        await user.type(await nameField(), "x");
        await user.dblClick(saveButton());
        await screen.findByText("Profile saved.");
        expect(bodies).toHaveLength(1);
    });

    it("maps a server field error onto the field", async () => {
        trackUpdates(() =>
            errorResponse(400, "VALIDATION_ERROR", {
                errors: [{ field: "name", message: "Invalid characters" }],
            })
        );
        const user = userEvent.setup();
        renderProfile();
        await user.type(await nameField(), "x");
        await user.click(saveButton());
        expect(await screen.findByText("Invalid characters")).toBeVisible();
        expect(await nameField()).toHaveAttribute("aria-invalid", "true");
    });

    it("shows a form-level error and keeps the input when the server fails", async () => {
        trackUpdates(() =>
            errorResponse(500, "INTERNAL", { requestId: "r-9" })
        );
        const user = userEvent.setup();
        renderProfile();
        const field = await nameField();
        await user.type(field, "x");
        await user.click(saveButton());
        expect(
            await screen.findByText(/Something went wrong on our side/)
        ).toBeVisible();
        expect(field).toHaveValue("Asha Vermax");
        expect(saveButton()).toBeEnabled();
    });

    it("shows a retry countdown on a rate limit and disables Save", async () => {
        trackUpdates(() =>
            errorResponse(429, "RATE_LIMITED", {
                headers: { "Retry-After": "45" },
            })
        );
        const user = userEvent.setup();
        renderProfile();
        await user.type(await nameField(), "x");
        await user.click(saveButton());
        expect(await screen.findByText(/You can try again in/)).toBeVisible();
        expect(saveButton()).toBeDisabled();
    });
});

describe("SettingsProfilePage language and time zone", () => {
    it("saves a new language and switches the interface to it", async () => {
        const bodies = trackUpdates();
        const user = userEvent.setup();
        const { store } = renderProfile();
        await nameField();
        await user.click(screen.getByRole("combobox", { name: "Language" }));
        await user.click(await screen.findByRole("option", { name: "हिन्दी" }));
        await user.click(saveButton());
        await waitFor(() => expect(bodies).toEqual([{ locale: "hi" }]));
        await waitFor(() => expect(store.getState().ui.language).toBe("hi"));
        expect(store.getState().auth.user.locale).toBe("hi");
        await waitFor(() => expect(i18n.language).toBe("hi"));
    });

    it("saves a new time zone from the browser list", async () => {
        const bodies = trackUpdates();
        const user = userEvent.setup();
        renderProfile();
        await nameField();
        await user.click(screen.getByRole("combobox", { name: "Time zone" }));
        await user.click(
            await screen.findByRole("option", { name: "Europe/London" })
        );
        await user.click(saveButton());
        await waitFor(() =>
            expect(bodies).toEqual([{ timezone: "Europe/London" }])
        );
        expect(await screen.findByText("Profile saved.")).toBeVisible();
        expect(
            screen.getByRole("combobox", { name: "Time zone" })
        ).toHaveTextContent("Europe/London");
    });

    it("keeps a saved time zone that the browser list lacks", async () => {
        server.use(
            http.get(profileUrl, () =>
                okResponse({
                    user: { ...makeUser(), timezone: "Etc/Custom-Zone" },
                })
            )
        );
        renderProfile();
        await nameField();
        expect(
            screen.getByRole("combobox", { name: "Time zone" })
        ).toHaveTextContent("Etc/Custom-Zone");
    });
});

describe("SettingsProfilePage unsaved changes", () => {
    async function dirtyAndLeave(user, router) {
        await user.type(await nameField(), "x");
        await act(() => router.navigate("/elsewhere"));
        return screen.findByRole("alertdialog");
    }

    it("asks before leaving with unsaved edits and stays when told to", async () => {
        const user = userEvent.setup();
        const { router } = renderProfile();
        const dialog = await dirtyAndLeave(user, router);
        expect(within(dialog).getByText("Leave without saving?")).toBeVisible();
        await user.click(
            within(dialog).getByRole("button", { name: "Keep editing" })
        );
        await waitFor(() =>
            expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
        );
        expect(router.state.location.pathname).toBe("/settings/profile");
        expect(await nameField()).toHaveValue("Asha Vermax");
    });

    it("leaves when confirmed", async () => {
        const user = userEvent.setup();
        const { router } = renderProfile();
        const dialog = await dirtyAndLeave(user, router);
        await user.click(
            within(dialog).getByRole("button", { name: "Leave page" })
        );
        await waitFor(() =>
            expect(router.state.location.pathname).toBe("/elsewhere")
        );
    });

    it("lets a pristine form navigate freely", async () => {
        const { router } = renderProfile();
        await nameField();
        await act(() => router.navigate("/elsewhere"));
        expect(router.state.location.pathname).toBe("/elsewhere");
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
});

describe("SettingsProfilePage Hindi", () => {
    it("renders in Hindi without accessibility violations", async () => {
        await i18n.changeLanguage("hi");
        const { container } = renderProfile();
        expect(await screen.findByLabelText("पूरा नाम")).toHaveValue(
            "Asha Verma"
        );
        expect(
            screen.getByRole("heading", { level: 1, name: "प्रोफ़ाइल" })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "बदलाव सहेजें" })
        ).toBeDisabled();
        await expectAccessible(container);
    });
});
