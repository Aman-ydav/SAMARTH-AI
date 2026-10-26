import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleCredentialButton } from "@/features/auth/components/GoogleCredentialButton";
import { expectAccessible } from "@/test/axeCheck";
import { fakeGoogle } from "@/test/googleSignInMock";
import { renderWithProviders } from "@/test/renderWithProviders";

const mocks = vi.hoisted(() => ({ env: {} }));

vi.mock("@/lib/env", async (importOriginal) => {
    const actual = await importOriginal();
    Object.assign(mocks.env, actual.env);
    return { env: mocks.env };
});
vi.mock("@react-oauth/google", async () =>
    (await import("@/test/googleSignInMock")).createGoogleModuleMock()
);

beforeEach(() => {
    Object.assign(mocks.env, {
        googleEnabled: true,
        googleClientId: "client-id.example.test",
    });
});

describe("GoogleCredentialButton", () => {
    it("renders nothing and mounts no provider without a client id", () => {
        mocks.env.googleEnabled = false;
        renderWithProviders(<GoogleCredentialButton onCredential={vi.fn()} />);
        expect(screen.queryByTestId("google-provider")).not.toBeInTheDocument();
    });

    it("hands the credential to the caller untouched", async () => {
        const onCredential = vi.fn();
        const user = userEvent.setup();
        const { container } = renderWithProviders(
            <GoogleCredentialButton onCredential={onCredential} />
        );
        expect(
            screen.getByRole("group", { name: "Sign in with Google" })
        ).toBeInTheDocument();
        await user.click(
            screen.getByRole("button", { name: "fake google ok" })
        );
        expect(onCredential).toHaveBeenCalledExactlyOnceWith(
            fakeGoogle.credential
        );
        await expectAccessible(container);
    });

    it("treats a response without a credential as a failed attempt and can retry", async () => {
        const onCredential = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(
            <GoogleCredentialButton onCredential={onCredential} />
        );
        await user.click(
            screen.getByRole("button", { name: "fake google empty" })
        );
        expect(
            await screen.findByText(/cancelled or did not complete/)
        ).toBeVisible();
        expect(onCredential).not.toHaveBeenCalled();
        await user.click(
            screen.getByRole("button", { name: "Try Google sign-in again" })
        );
        expect(screen.queryByText(/cancelled or did not complete/)).toBeNull();
    });

    it("explains a blocked Google script and keeps everything else usable", async () => {
        const user = userEvent.setup();
        renderWithProviders(<GoogleCredentialButton onCredential={vi.fn()} />);
        await user.click(
            screen.getByRole("button", { name: "fake google script error" })
        );
        expect(
            await screen.findByText(
                /browser setting or extension may be blocking/
            )
        ).toBeVisible();
    });

    it("clears an earlier problem once a credential arrives", async () => {
        const onCredential = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(
            <GoogleCredentialButton onCredential={onCredential} />
        );
        await user.click(
            screen.getByRole("button", { name: "fake google error" })
        );
        await screen.findByText(/cancelled or did not complete/);
        await user.click(
            screen.getByRole("button", { name: "fake google ok" })
        );
        expect(screen.queryByText(/cancelled or did not complete/)).toBeNull();
        expect(onCredential).toHaveBeenCalledTimes(1);
    });
});
