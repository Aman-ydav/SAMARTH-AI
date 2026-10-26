import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SignupPage from "@/features/auth/pages/SignupPage";
import { i18n } from "@/i18n";
import { anonymousAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { setMotionTier } from "@/test/motionTier";
import { renderAuthPage } from "@/test/renderAuthPage";

vi.mock("@/lib/env", async (importOriginal) => {
    const actual = await importOriginal();
    return { env: { ...actual.env, googleEnabled: false, googleClientId: "" } };
});

setupMockServer();

beforeEach(() => setMotionTier("reduced"));
afterEach(async () => {
    await i18n.changeLanguage("en");
});

const renderSignup = (entry = "/signup") =>
    renderAuthPage(<SignupPage />, {
        path: "/signup",
        entry,
        preloadedState: { auth: anonymousAuth },
    });

describe("SignupPage", () => {
    it("has one h1, one main landmark and a sign-in link", async () => {
        const { container } = renderSignup();
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "Create your account",
            })
        ).toBeInTheDocument();
        expect(screen.getAllByRole("main")).toHaveLength(1);
        expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
            "href",
            "/login"
        );
        expect(document.title).toBe("Create your account | SAMARTH AI");
        await expectAccessible(container);
    });

    it("prefills name and email from an invitation link", () => {
        renderSignup("/signup?name=Dr.%20Rao&email=rao%40example.test");
        expect(screen.getByLabelText("Full name")).toHaveValue("Dr. Rao");
        expect(screen.getByLabelText("Email")).toHaveValue("rao@example.test");
    });

    it.each([
        ["control characters", "/signup?name=a%00b&email=x%0Ay%40example.test"],
        [
            "oversized values",
            `/signup?name=${"n".repeat(81)}&email=${"e".repeat(255)}`,
        ],
    ])("ignores prefill values with %s", (_label, entry) => {
        renderSignup(entry);
        expect(screen.getByLabelText("Full name")).toHaveValue("");
        expect(screen.getByLabelText("Email")).toHaveValue("");
    });

    it("renders in Hindi", async () => {
        await i18n.changeLanguage("hi");
        const { container } = renderSignup();
        expect(
            screen.getByRole("heading", { level: 1, name: "अपना खाता बनाएँ" })
        ).toBeInTheDocument();
        await expectAccessible(container);
    });
});
