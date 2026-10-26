import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, delay } from "msw";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppSelector } from "@/app/hooks";
import { AvatarEditor } from "@/features/auth/components/AvatarEditor";
import { selectCurrentUser } from "@/features/auth/slice/authSlice";
import { i18n } from "@/i18n";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { makeUser } from "@/mocks/fixtures/user";
import { signedInAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { renderPage } from "@/test/pageHarness";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/* Each case uploads and reads real multipart bodies through MSW, which is slow under coverage instrumentation. */
vi.setConfig({ testTimeout: 20000 });

const server = setupMockServer();
const avatarUrl = apiUrl("/me/avatar");
const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4];
const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const SAVED = { publicId: "samarth-ai/test/avatars/saved", version: 2 };
const MB = 1024 * 1024;

const imageFile = (name = "me.png", type = "image/png", bytes = PNG_BYTES) =>
    new File([new Uint8Array(bytes)], name, { type });

/* The page passes the signed-in user; the harness reads it from the store the same way. */
function EditorHarness() {
    const user = useAppSelector(selectCurrentUser);
    return <AvatarEditor user={user} />;
}

beforeEach(() => {
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
    URL.createObjectURL = vi.fn(() => "blob:preview-1");
    URL.revokeObjectURL = vi.fn();
});
afterEach(async () => {
    await i18n.changeLanguage("en");
});

function renderEditor(userOverrides = {}) {
    return renderPage(EditorHarness, {
        path: "/settings/profile",
        preloadedState: { auth: signedInAuth(userOverrides) },
    });
}

const fileInput = () => screen.getByLabelText("Profile photo file");
async function chooseValid(user = userEvent.setup({ applyAccept: false })) {
    await user.upload(fileInput(), imageFile());
    await screen.findByRole("img", {
        name: "Preview of the new profile photo",
    });
    return user;
}

describe("AvatarEditor idle state", () => {
    it("shows initials, the honest limits and no remove button without a photo", async () => {
        const { container } = renderEditor();
        expect(
            screen.getByRole("heading", { name: "Profile photo" })
        ).toBeVisible();
        expect(screen.getByText("AV")).toBeInTheDocument();
        expect(screen.getByText(/JPEG, PNG or WebP, up to 2 MB/)).toBeVisible();
        expect(
            screen.getByText(/Camera and location details are removed/)
        ).toBeVisible();
        expect(
            screen.getByRole("button", { name: "Choose photo" })
        ).toBeEnabled();
        expect(
            screen.queryByRole("button", { name: "Remove photo" })
        ).not.toBeInTheDocument();
        expect(fileInput()).toHaveAttribute(
            "accept",
            "image/jpeg,image/png,image/webp"
        );
        await expectAccessible(container);
    });

    it("offers change and remove when a photo is saved", () => {
        renderEditor({ avatar: SAVED });
        expect(
            screen.getByRole("button", { name: "Change photo" })
        ).toBeEnabled();
        expect(
            screen.getByRole("button", { name: "Remove photo" })
        ).toBeEnabled();
    });
});

describe("AvatarEditor choosing a file (client pre-checks)", () => {
    it("previews a valid image and uploads nothing until Save photo", async () => {
        let uploads = 0;
        server.use(
            http.put(avatarUrl, () => {
                uploads += 1;
                return okResponse({ user: makeUser() });
            })
        );
        const { container } = renderEditor();
        await chooseValid();
        expect(
            screen.getByRole("img", {
                name: "Preview of the new profile photo",
            })
        ).toHaveAttribute("src", "blob:preview-1");
        expect(screen.getByText(/not saved until you select/)).toBeVisible();
        expect(
            screen.getByRole("button", { name: "Save photo" })
        ).toBeEnabled();
        expect(uploads).toBe(0);
        await expectAccessible(container);
    });

    it.each([
        [
            "a GIF",
            () => imageFile("fun.gif", "image/gif"),
            "Use a JPEG, PNG or WebP image.",
        ],
        [
            "an SVG",
            () => imageFile("logo.svg", "image/svg+xml"),
            "Use a JPEG, PNG or WebP image.",
        ],
        [
            "an empty file",
            () => imageFile("me.png", "image/png", []),
            "That file is empty. Choose a photo.",
        ],
        [
            "a renamed file whose bytes are not an image",
            () =>
                imageFile(
                    "me.png",
                    "image/png",
                    [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9]
                ),
            /not really a JPEG, PNG or WebP image/,
        ],
        [
            "a JPEG pretending to be a PNG",
            () => imageFile("me.png", "image/png", JPEG_BYTES),
            /not really a JPEG, PNG or WebP image/,
        ],
    ])("rejects %s without any request", async (_name, make, message) => {
        let uploads = 0;
        server.use(
            http.put(avatarUrl, () => {
                uploads += 1;
                return okResponse({ user: makeUser() });
            })
        );
        renderEditor();
        await userEvent
            .setup({ applyAccept: false })
            .upload(fileInput(), make());
        expect(await screen.findByRole("alert")).toHaveTextContent(message);
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Save photo" })
        ).not.toBeInTheDocument();
        expect(uploads).toBe(0);
    });

    it("rejects a file over 2 MB", async () => {
        renderEditor();
        const big = imageFile();
        Object.defineProperty(big, "size", { value: 2 * MB + 1 });
        await userEvent.setup({ applyAccept: false }).upload(fileInput(), big);
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "That photo is larger than 2 MB. Choose a smaller one."
        );
    });

    it("discards the chosen file and its preview", async () => {
        renderEditor();
        const user = await chooseValid();
        await user.click(screen.getByRole("button", { name: "Discard" }));
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Choose photo" })
        ).toBeVisible();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
    });

    it("replaces an earlier problem when a valid file is chosen next", async () => {
        renderEditor();
        const user = userEvent.setup({ applyAccept: false });
        await user.upload(fileInput(), imageFile("fun.gif", "image/gif"));
        await screen.findByRole("alert");
        await user.upload(fileInput(), imageFile());
        await screen.findByRole("img", {
            name: "Preview of the new profile photo",
        });
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
});

describe("AvatarEditor uploading", () => {
    it("shows progress while uploading, then updates the saved photo and toasts", async () => {
        server.use(
            http.put(avatarUrl, async () => {
                await delay(150);
                return okResponse({
                    user: makeUser({
                        avatar: {
                            publicId: "samarth-ai/test/avatars/new",
                            version: 5,
                        },
                    }),
                });
            })
        );
        const { store } = renderEditor();
        const user = await chooseValid();
        await user.click(screen.getByRole("button", { name: "Save photo" }));
        expect(await screen.findByText("Uploading your photo…")).toBeVisible();
        expect(
            screen.getByRole("progressbar", { name: "Upload progress" })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Cancel upload" })
        ).toBeEnabled();
        expect(
            screen.getByRole("button", { name: /Save photo/ })
        ).toBeDisabled();
        await waitFor(() =>
            expect(store.getState().auth.user.avatar.publicId).toBe(
                "samarth-ai/test/avatars/new"
            )
        );
        expect(await screen.findByText("Photo updated.")).toBeVisible();
        expect(toast.success).toHaveBeenCalledWith(
            "Photo updated.",
            expect.objectContaining({ id: "avatar-updated" })
        );
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Change photo" })
        ).toBeVisible();
    });

    it("sends one request for a double click", async () => {
        let uploads = 0;
        server.use(
            http.put(avatarUrl, async () => {
                uploads += 1;
                await delay(50);
                return okResponse({ user: makeUser() });
            })
        );
        renderEditor();
        const user = await chooseValid();
        await user.dblClick(screen.getByRole("button", { name: "Save photo" }));
        await screen.findByText("Photo updated.");
        expect(uploads).toBe(1);
    });

    it("cancels a running upload for real and keeps the file for another try", async () => {
        let aborted = false;
        server.use(
            http.put(avatarUrl, async ({ request }) => {
                request.signal.addEventListener("abort", () => {
                    aborted = true;
                });
                await delay("infinite");
                return okResponse({ user: makeUser() });
            })
        );
        const { store } = renderEditor({ avatar: SAVED });
        const user = await chooseValid();
        await user.click(screen.getByRole("button", { name: "Save photo" }));
        await user.click(
            await screen.findByRole("button", { name: "Cancel upload" })
        );
        expect(
            await screen.findByText(
                "Upload cancelled. Your photo is unchanged."
            )
        ).toBeVisible();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(store.getState().auth.user.avatar).toEqual(SAVED);
        expect(
            screen.getByRole("img", {
                name: "Preview of the new profile photo",
            })
        ).toBeVisible();
        expect(
            screen.getByRole("button", { name: "Save photo" })
        ).toBeEnabled();
        expect(aborted).toBe(true);
    });

    it.each([
        [400, "MEDIA_TYPE_NOT_ALLOWED", "That file type is not allowed."],
        [413, "FILE_TOO_LARGE", "That file is too large."],
        [400, "UPLOAD_INVALID", "The upload was not valid."],
        [502, "MEDIA_UPLOAD_FAILED", "The upload failed. Please try again."],
    ])(
        "maps %i %s to a clear message, keeps the old photo and allows a retry",
        async (status, code, message) => {
            server.use(http.put(avatarUrl, () => errorResponse(status, code)));
            const { store } = renderEditor({ avatar: SAVED });
            const user = await chooseValid();
            await user.click(
                screen.getByRole("button", { name: "Save photo" })
            );
            expect(await screen.findByRole("alert")).toHaveTextContent(message);
            expect(store.getState().auth.user.avatar).toEqual(SAVED);
            expect(
                screen.getByRole("img", {
                    name: "Preview of the new profile photo",
                })
            ).toBeVisible();
            await waitFor(() =>
                expect(
                    screen.getByRole("button", { name: "Save photo" })
                ).toBeEnabled()
            );
        }
    );

    it("shows the daily rate limit with a countdown and blocks Save until it ends", async () => {
        server.use(
            http.put(avatarUrl, () =>
                errorResponse(429, "RATE_LIMITED", {
                    headers: { "Retry-After": "90" },
                })
            )
        );
        renderEditor();
        const user = await chooseValid();
        await user.click(screen.getByRole("button", { name: "Save photo" }));
        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("Too many requests");
        expect(alert).toHaveTextContent(/You can try again in/);
        expect(
            screen.getByRole("button", { name: "Save photo" })
        ).toBeDisabled();
    });

    it("recovers after a network failure and uploads on retry", async () => {
        let calls = 0;
        server.use(
            http.put(avatarUrl, () => {
                calls += 1;
                return calls === 1
                    ? Response.error()
                    : okResponse({
                          user: makeUser({ avatar: SAVED }),
                      });
            })
        );
        renderEditor();
        const user = await chooseValid();
        await user.click(screen.getByRole("button", { name: "Save photo" }));
        expect(await screen.findByRole("alert")).toHaveTextContent(
            /could not reach the server/
        );
        await user.click(screen.getByRole("button", { name: "Save photo" }));
        expect(await screen.findByText("Photo updated.")).toBeVisible();
    });
});

describe("AvatarEditor Hindi", () => {
    it("renders in Hindi without accessibility violations", async () => {
        await i18n.changeLanguage("hi");
        const { container } = renderEditor();
        expect(
            screen.getByRole("heading", { name: "प्रोफ़ाइल फ़ोटो" })
        ).toBeVisible();
        expect(
            screen.getByRole("button", { name: "फ़ोटो चुनें" })
        ).toBeEnabled();
        await expectAccessible(container);
    });
});
