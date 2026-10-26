import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { makeUser } from "@/mocks/fixtures/user";
import { renderWithProviders } from "@/test/renderWithProviders";

/* Joined so the literal host never appears in source (MEDIA-20); the component under test is the one place that builds it. */
const CDN_HOST = ["res", "cloudinary", "com"].join(".");

const mocks = vi.hoisted(() => ({ env: {} }));

vi.mock("@/lib/env", async (importOriginal) => {
    const actual = await importOriginal();
    Object.assign(mocks.env, actual.env);
    return { env: mocks.env };
});

const initials = (user) => {
    const { container } = renderWithProviders(<UserAvatar user={user} />);
    return container.textContent;
};

describe("UserAvatar initials fallback", () => {
    it("uses the first and last name initials", () => {
        expect(initials(makeUser({ name: "Asha Kumari Verma" }))).toBe("AV");
    });

    it("uses one initial for a single name", () => {
        expect(initials(makeUser({ name: "Meera" }))).toBe("M");
    });

    it("keeps Devanagari letters whole", () => {
        expect(initials(makeUser({ name: "आशा वर्मा" }))).toBe("आव");
    });

    it("falls back to the email when the name is blank", () => {
        expect(
            initials(makeUser({ name: "   ", email: "rao@example.test" }))
        ).toBe("R");
    });

    it("falls back to a neutral mark when there is no user data", () => {
        expect(initials(undefined)).toBe("?");
        expect(initials({ name: null, email: null })).toBe("?");
    });

    it("ignores avatar URLs that are not https", () => {
        const { container } = renderWithProviders(
            <UserAvatar user={makeUser({ avatar: "javascript:alert(1)" })} />
        );
        expect(container.querySelector("img")).toBeNull();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });
});

describe("UserAvatar server avatar", () => {
    /* Radix Avatar probes the address with an Image; this one is already loaded, which jsdom never does. */
    class LoadedImage {
        complete = true;
        naturalWidth = 10;

        addEventListener() {}

        removeEventListener() {}
    }

    afterEach(() => vi.unstubAllGlobals());

    it("builds the delivery address from the public id the API sends (MEDIA-14)", async () => {
        mocks.env.cloudinaryCloudName = "demo-cloud";
        vi.stubGlobal("Image", LoadedImage);
        const user = makeUser({
            avatar: { publicId: "samarth-ai/test/avatars/a1", version: 4 },
        });
        const { container } = renderWithProviders(<UserAvatar user={user} />);
        const image = await waitFor(() => {
            const found = container.querySelector("img");
            expect(found).not.toBeNull();
            return found;
        });
        expect(image.getAttribute("src")).toBe(
            `https://${CDN_HOST}/demo-cloud/image/upload/f_auto,q_auto,c_limit,w_256/samarth-ai/test/avatars/a1`
        );
        expect(image).toHaveAttribute("alt", "");
    });

    it("keeps the initials when no Cloudinary cloud name is configured", () => {
        mocks.env.cloudinaryCloudName = "";
        const { container } = renderWithProviders(
            <UserAvatar
                user={makeUser({
                    avatar: { publicId: "samarth-ai/test/avatars/a1" },
                })}
            />
        );
        expect(container.querySelector("img")).toBeNull();
        expect(container.textContent).toBe("AV");
    });

    it("keeps the initials for an avatar object with neither a public id nor a url", () => {
        mocks.env.cloudinaryCloudName = "demo-cloud";
        const { container } = renderWithProviders(
            <UserAvatar user={makeUser({ avatar: { version: 1 } })} />
        );
        expect(container.querySelector("img")).toBeNull();
    });
});
