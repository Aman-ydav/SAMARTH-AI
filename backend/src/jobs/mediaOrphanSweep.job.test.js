import { describe, expect, it, vi } from "vitest";
import { sweepMedia } from "#modules/media/index.js";
import {
    MEDIA_ORPHAN_SWEEP,
    runMediaOrphanSweep,
} from "./mediaOrphanSweep.job.js";

// The module index also builds the real routes (needs the auth middlewares); the job only needs the sweep function.
vi.mock("#modules/media/index.js", () => ({ sweepMedia: vi.fn() }));

const SUMMARY = {
    dryRun: false,
    stalePending: { found: 1, purged: 1, failed: 0 },
};

describe("mediaOrphanSweep job (MEDIA-12)", () => {
    it("is registered for 03:00 UTC daily", () => {
        expect(MEDIA_ORPHAN_SWEEP).toEqual({
            name: "mediaOrphanSweep",
            cron: "0 3 * * *",
        });
        expect(Object.isFrozen(MEDIA_ORPHAN_SWEEP)).toBe(true);
    });

    it("runs the sweep and returns its counts", async () => {
        sweepMedia.mockResolvedValueOnce(SUMMARY);
        await expect(runMediaOrphanSweep()).resolves.toBe(SUMMARY);
        expect(sweepMedia).toHaveBeenCalledWith(
            expect.objectContaining({ log: expect.anything() })
        );
    });

    it("passes the dry-run flag and a fixed clock through", async () => {
        const now = new Date("2026-10-26T03:00:00.000Z");
        sweepMedia.mockResolvedValueOnce({ ...SUMMARY, dryRun: true });
        const result = await runMediaOrphanSweep({ dryRun: true, now });
        expect(sweepMedia).toHaveBeenLastCalledWith(
            expect.objectContaining({ dryRun: true, now })
        );
        expect(result.dryRun).toBe(true);
    });

    it("lets a failing sweep reject so the scheduler can see it", async () => {
        sweepMedia.mockRejectedValueOnce(new Error("db down"));
        await expect(runMediaOrphanSweep()).rejects.toThrow("db down");
    });
});
