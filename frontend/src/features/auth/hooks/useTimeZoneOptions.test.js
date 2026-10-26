import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
});

async function load() {
    return import("@/features/auth/hooks/useTimeZoneOptions");
}

describe("listTimeZones", () => {
    it("uses the browser list when Intl can provide it", async () => {
        const { listTimeZones } = await load();
        const zones = listTimeZones();
        expect(zones.length).toBeGreaterThan(100);
        expect(zones.some((zone) => zone.startsWith("Europe/"))).toBe(true);
        expect(listTimeZones()).toBe(zones);
    });

    it("falls back to a short safe list when supportedValuesOf is missing", async () => {
        vi.spyOn(Intl, "supportedValuesOf", "get").mockReturnValue(undefined);
        const { listTimeZones } = await load();
        const zones = listTimeZones();
        expect(zones).toContain("Asia/Kolkata");
        expect(zones).toContain("UTC");
        expect(zones.length).toBeLessThan(20);
    });

    it("falls back when supportedValuesOf throws", async () => {
        vi.spyOn(Intl, "supportedValuesOf").mockImplementation(() => {
            throw new RangeError("unsupported");
        });
        const { listTimeZones } = await load();
        expect(listTimeZones()).toContain("Asia/Kolkata");
    });

    it("falls back when the browser returns an empty list", async () => {
        vi.spyOn(Intl, "supportedValuesOf").mockReturnValue([]);
        const { listTimeZones } = await load();
        expect(listTimeZones()).toContain("UTC");
    });
});

describe("useTimeZoneOptions", () => {
    it("returns the list unchanged when the saved zone is in it", async () => {
        const { listTimeZones, useTimeZoneOptions } = await load();
        const listed = listTimeZones()[10];
        const { result } = renderHook(() => useTimeZoneOptions(listed));
        expect(result.current).toBe(listTimeZones());
    });

    it("puts a saved zone the browser does not list first", async () => {
        const { listTimeZones, useTimeZoneOptions } = await load();
        const { result } = renderHook(() => useTimeZoneOptions("Etc/Custom"));
        expect(result.current[0]).toBe("Etc/Custom");
        expect(result.current).toHaveLength(listTimeZones().length + 1);
    });

    it("ignores an empty or missing saved zone", async () => {
        const { listTimeZones, useTimeZoneOptions } = await load();
        expect(renderHook(() => useTimeZoneOptions("")).result.current).toBe(
            listTimeZones()
        );
        expect(
            renderHook(() => useTimeZoneOptions(undefined)).result.current
        ).toBe(listTimeZones());
    });
});
