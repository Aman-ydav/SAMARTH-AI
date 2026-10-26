import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authChannel } from "@/lib/authChannel";

class FakeChannel {
    static instances = [];
    constructor(name) {
        this.name = name;
        this.listeners = new Set();
        this.messages = [];
        FakeChannel.instances.push(this);
    }
    postMessage(message) {
        this.messages.push(message);
    }
    addEventListener(type, listener) {
        this.listeners.add(listener);
    }
    removeEventListener(type, listener) {
        this.listeners.delete(listener);
    }
    close() {
        this.closed = true;
    }
}

beforeEach(() => {
    FakeChannel.instances = [];
    vi.stubGlobal("BroadcastChannel", FakeChannel);
});

afterEach(() => {
    authChannel.close();
    vi.unstubAllGlobals();
});

describe("authChannel", () => {
    it("posts only the type and a timestamp on the sai-auth channel", () => {
        expect(authChannel.post("logout")).toBe(true);
        const [channel] = FakeChannel.instances;
        expect(channel.name).toBe("sai-auth");
        expect(Object.keys(channel.messages[0]).sort()).toEqual(["at", "type"]);
        expect(channel.messages[0].type).toBe("logout");
    });

    it("rejects unknown message types", () => {
        expect(authChannel.post("token")).toBe(false);
        expect(FakeChannel.instances).toHaveLength(0);
    });

    it("delivers login and logout messages and ignores everything else", () => {
        const handler = vi.fn();
        const off = authChannel.subscribe(handler);
        const [channel] = FakeChannel.instances;
        for (const listener of channel.listeners) {
            listener({ data: { type: "logout", at: 1 } });
            listener({ data: { type: "login", at: 2 } });
            listener({ data: { type: "other" } });
            listener({ data: null });
        }
        expect(handler.mock.calls).toEqual([["logout"], ["login"]]);
        off();
        expect(channel.listeners.size).toBe(0);
    });

    it("is a no-op without BroadcastChannel", () => {
        vi.stubGlobal("BroadcastChannel", undefined);
        expect(authChannel.post("login")).toBe(false);
        expect(authChannel.subscribe(vi.fn())()).toBeUndefined();
    });

    it("survives a failing constructor and a failing postMessage", () => {
        vi.stubGlobal(
            "BroadcastChannel",
            class {
                constructor() {
                    throw new Error("blocked");
                }
            }
        );
        expect(authChannel.post("login")).toBe(false);
        vi.stubGlobal(
            "BroadcastChannel",
            class {
                postMessage() {
                    throw new Error("closed");
                }
                addEventListener() {}
                removeEventListener() {}
                close() {}
            }
        );
        expect(authChannel.post("login")).toBe(false);
    });
});
