import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBanners } from "@/app/providers/StatusBanners";
import { offlineChanged, serverWakingChanged } from "@/features/preferences";
import { renderWithProviders } from "@/test/renderWithProviders";

describe("StatusBanners", () => {
    it("renders nothing when online and awake", () => {
        const { container } = renderWithProviders(<StatusBanners />);
        expect(container).toBeEmptyDOMElement();
    });

    it("shows the offline banner and removes it on reconnect", () => {
        const { store } = renderWithProviders(<StatusBanners />);
        act(() => {
            store.dispatch(offlineChanged(true));
        });
        expect(screen.getByRole("status")).toHaveTextContent(/offline/i);
        act(() => {
            store.dispatch(offlineChanged(false));
        });
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("shows the waking-up banner while the server starts", () => {
        const { store } = renderWithProviders(<StatusBanners />);
        act(() => {
            store.dispatch(serverWakingChanged(true));
        });
        expect(screen.getByRole("status")).toHaveTextContent(
            /waking up the server/i
        );
    });

    it("can show both banners at once", () => {
        renderWithProviders(<StatusBanners />, {
            preloadedState: {
                ui: {
                    theme: "system",
                    language: "en",
                    sidebarCollapsed: false,
                    offline: true,
                    serverWaking: true,
                },
            },
        });
        expect(screen.getAllByRole("status")).toHaveLength(2);
    });
});
