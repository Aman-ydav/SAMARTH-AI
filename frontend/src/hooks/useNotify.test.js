import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { notify, useNotify } from "@/hooks/useNotify";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
});

describe("notify", () => {
    it("shows a toast of the given type with a deduplication id", async () => {
        await notify("success", "Saved.", "saved-once");
        expect(toast.success).toHaveBeenCalledExactlyOnceWith("Saved.", {
            id: "saved-once",
        });
    });

    it("works without an id", async () => {
        await notify("error", "Nope.");
        expect(toast.error).toHaveBeenCalledExactlyOnceWith("Nope.", undefined);
    });

    it("is the stable function the hook hands out", () => {
        expect(useNotify()).toBe(notify);
    });
});
