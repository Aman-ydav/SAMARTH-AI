import { describe, expect, it, vi } from "vitest";
import { runInBackground, whenBackgroundIdle } from "./backgroundTasks.js";

describe("runInBackground", () => {
    it("does not run the work before the caller yields, and whenBackgroundIdle waits for it", async () => {
        const order = [];
        runInBackground(async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            order.push("work");
        });
        order.push("after call");
        expect(order).toEqual(["after call"]);
        await whenBackgroundIdle();
        expect(order).toEqual(["after call", "work"]);
    });

    it("logs a failure instead of throwing, with the task label", async () => {
        const log = { error: vi.fn() };
        const failure = new Error("boom");
        runInBackground(
            async () => {
                throw failure;
            },
            { log, label: "demo task" }
        );
        await whenBackgroundIdle();
        expect(log.error).toHaveBeenCalledWith(
            { err: failure, task: "demo task" },
            "background task failed"
        );
    });

    it("waits for tasks started by other tasks", async () => {
        const seen = [];
        runInBackground(async () => {
            seen.push("outer");
            runInBackground(async () => seen.push("inner"));
        });
        await whenBackgroundIdle();
        expect(seen).toEqual(["outer", "inner"]);
    });

    it("resolves immediately when nothing is running", async () => {
        await expect(whenBackgroundIdle()).resolves.toBeUndefined();
    });
});
