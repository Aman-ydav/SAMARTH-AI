import { afterEach, describe, expect, it, vi } from "vitest";
import { API_EVENTS, apiEvents } from "@/lib/apiEvents";

afterEach(() => apiEvents.clear());

describe("apiEvents", () => {
    it("delivers events to subscribers and supports unsubscribe", () => {
        const handler = vi.fn();
        const off = apiEvents.on(API_EVENTS.SESSION_EXPIRED, handler);
        apiEvents.emit(API_EVENTS.SESSION_EXPIRED, {
            reason: "SESSION_EXPIRED",
        });
        off();
        apiEvents.emit(API_EVENTS.SESSION_EXPIRED, { reason: "again" });
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({ reason: "SESSION_EXPIRED" });
    });

    it("keeps delivering when one subscriber throws and surfaces the failure asynchronously", () => {
        const second = vi.fn();
        const deferred = [];
        vi.stubGlobal("queueMicrotask", (callback) => deferred.push(callback));
        apiEvents.on(API_EVENTS.SERVER_WAKING, () => {
            throw new Error("faulty");
        });
        apiEvents.on(API_EVENTS.SERVER_WAKING, second);
        expect(() =>
            apiEvents.emit(API_EVENTS.SERVER_WAKING, { active: true })
        ).not.toThrow();
        expect(second).toHaveBeenCalledWith({ active: true });
        expect(deferred).toHaveLength(1);
        expect(deferred[0]).toThrow("faulty");
        vi.unstubAllGlobals();
    });

    it("ignores events nobody listens to", () => {
        expect(() => apiEvents.emit("nothing")).not.toThrow();
    });
});
