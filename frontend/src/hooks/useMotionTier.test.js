import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    MOTION_TIERS,
    isSaveDataEnabled,
    useMotionTier,
} from "@/hooks/useMotionTier";
import { setMotionTier } from "@/test/motionTier";

function setSaveData(value) {
    Object.defineProperty(navigator, "connection", {
        value: value === undefined ? undefined : { saveData: value },
        configurable: true,
    });
}

describe("useMotionTier", () => {
    beforeEach(() => setMotionTier("full"));
    afterEach(() => setSaveData(undefined));

    it("is full on a wide fine-pointer screen without preferences", () => {
        const { result } = renderHook(() => useMotionTier());
        expect(result.current).toBe(MOTION_TIERS.FULL);
    });

    it("is reduced when the user prefers reduced motion", () => {
        setMotionTier("reduced");
        const { result } = renderHook(() => useMotionTier());
        expect(result.current).toBe(MOTION_TIERS.REDUCED);
    });

    it("is lite on a narrow or coarse-pointer screen", () => {
        setMotionTier("lite");
        const { result } = renderHook(() => useMotionTier());
        expect(result.current).toBe(MOTION_TIERS.LITE);
    });

    it("is lite when the browser asks to save data", () => {
        setSaveData(true);
        const { result } = renderHook(() => useMotionTier());
        expect(result.current).toBe(MOTION_TIERS.LITE);
        expect(isSaveDataEnabled()).toBe(true);
    });

    it("lets reduced motion win over save data", () => {
        setSaveData(true);
        setMotionTier("reduced");
        const { result } = renderHook(() => useMotionTier());
        expect(result.current).toBe(MOTION_TIERS.REDUCED);
    });

    it("falls back to lite when matchMedia is unavailable", () => {
        const original = window.matchMedia;
        window.matchMedia = undefined;
        const { result } = renderHook(() => useMotionTier());
        expect(result.current).toBe(MOTION_TIERS.LITE);
        window.matchMedia = original;
    });
});
