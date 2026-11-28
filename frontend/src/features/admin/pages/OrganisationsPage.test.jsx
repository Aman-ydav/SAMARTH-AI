import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { makeOrganisation } from "@/mocks/fixtures/organisation";
import { apiUrl, okResponse, pageMeta } from "@/mocks/fixtures/envelope";
import { expectAccessible } from "@/test/axeCheck";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { renderPage } from "@/test/pageHarness";
import OrganisationsPage from "./OrganisationsPage";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const server = setupMockServer();

afterEach(async () => {
    await i18n.changeLanguage("en");
});

describe("OrganisationsPage", () => {
    it("creates an organisation with tenant registration settings", async () => {
        let body = null;
        server.use(
            http.get(apiUrl("/organisations"), () =>
                okResponse(
                    { organisations: [makeOrganisation()] },
                    { meta: pageMeta({ total: 1 }) }
                )
            ),
            http.post(apiUrl("/organisations"), async ({ request }) => {
                body = await request.json();
                return okResponse(
                    {
                        organisation: makeOrganisation({
                            id: "64b7f0c2a1b2c3d4e5f60309",
                            name: body.name,
                            code: body.code,
                            settings: body.settings,
                        }),
                    },
                    { status: 201 }
                );
            })
        );
        const user = userEvent.setup();
        renderPage(OrganisationsPage);
        await screen.findByText("Organisation directory");
        await user.type(
            screen.getByLabelText("Organisation name"),
            "Regional Statistics"
        );
        await user.type(
            screen.getByLabelText("Registration code"),
            "regional-statistics"
        );
        await user.type(
            screen.getByLabelText("Allowed email domains"),
            "example.gov.in, example.nic.in"
        );
        await user.click(screen.getByRole("button", { name: "Save organisation" }));

        await waitFor(() =>
            expect(body).toEqual({
                name: "Regional Statistics",
                code: "regional-statistics",
                settings: {
                    allowSelfRegistration: true,
                    allowedEmailDomains: [
                        "example.gov.in",
                        "example.nic.in",
                    ],
                    requireEmailVerification: true,
                    allowGoogleLogin: true,
                },
            })
        );
    });

    it("renders translated and accessible tenant controls", async () => {
        await i18n.changeLanguage("hi");
        server.use(
            http.get(apiUrl("/organisations"), () =>
                okResponse(
                    { organisations: [makeOrganisation()] },
                    { meta: pageMeta({ total: 1 }) }
                )
            )
        );
        const { container } = renderPage(OrganisationsPage);
        expect(
            await screen.findByRole("heading", {
                level: 1,
                name: "संगठन",
            })
        ).toBeVisible();
        expect(
            await screen.findByText("पंजीकरण कोड: default")
        ).toBeVisible();
        await expectAccessible(container);
    });
});
