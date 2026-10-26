import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { registerGracefulShutdown, registerProcessGuards } from "./shutdown.js";

const makeLogger = () => ({ info: vi.fn(), error: vi.fn(), fatal: vi.fn() });
const makeServer = (closeError) => ({
    close: vi.fn((callback) => setImmediate(() => callback(closeError))),
    closeIdleConnections: vi.fn(),
});

describe("registerGracefulShutdown", () => {
    it("stops the server, runs closers in order, then exits 0", async () => {
        const order = [];
        const server = makeServer();
        const exit = vi.fn();
        const shutdown = registerGracefulShutdown({
            server,
            closers: [
                async () => order.push("db"),
                async () => order.push("cache"),
            ],
            logger: makeLogger(),
            exit,
            proc: new EventEmitter(),
        });
        await shutdown("SIGTERM");
        expect(server.close).toHaveBeenCalledOnce();
        expect(server.closeIdleConnections).toHaveBeenCalled();
        expect(order).toEqual(["db", "cache"]);
        expect(exit).toHaveBeenCalledWith(0);
    });

    it("listens for SIGTERM and SIGINT", async () => {
        const proc = new EventEmitter();
        const exit = vi.fn();
        registerGracefulShutdown({
            server: makeServer(),
            logger: makeLogger(),
            exit,
            proc,
        });
        expect(proc.listenerCount("SIGTERM")).toBe(1);
        expect(proc.listenerCount("SIGINT")).toBe(1);
        proc.emit("SIGINT");
        await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    });

    it("ignores a second signal while shutting down", async () => {
        const server = makeServer();
        const shutdown = registerGracefulShutdown({
            server,
            logger: makeLogger(),
            exit: vi.fn(),
            proc: new EventEmitter(),
        });
        await Promise.all([shutdown("SIGTERM"), shutdown("SIGINT")]);
        expect(server.close).toHaveBeenCalledOnce();
    });

    it("exits 1 when the server fails to close or a closer throws", async () => {
        const failing = vi.fn();
        await registerGracefulShutdown({
            server: makeServer(new Error("close failed")),
            logger: makeLogger(),
            exit: failing,
            proc: new EventEmitter(),
        })("SIGTERM");
        expect(failing).toHaveBeenCalledWith(1);

        const closerFails = vi.fn();
        await registerGracefulShutdown({
            server: makeServer(),
            closers: [async () => Promise.reject(new Error("db"))],
            logger: makeLogger(),
            exit: closerFails,
            proc: new EventEmitter(),
        })("SIGTERM");
        expect(closerFails).toHaveBeenCalledWith(1);
    });

    it("forces exit 1 after the hard timeout when draining never finishes", async () => {
        vi.useFakeTimers();
        const exit = vi.fn();
        const hanging = { close: vi.fn(), closeIdleConnections: vi.fn() };
        void registerGracefulShutdown({
            server: hanging,
            logger: makeLogger(),
            timeoutMs: 10_000,
            exit,
            proc: new EventEmitter(),
        })("SIGTERM");
        await vi.advanceTimersByTimeAsync(10_001);
        expect(exit).toHaveBeenCalledWith(1);
    });
});

describe("registerProcessGuards", () => {
    it("logs fatal and exits 1 on uncaughtException and unhandledRejection (BE-07)", () => {
        const proc = new EventEmitter();
        const logger = makeLogger();
        const exit = vi.fn();
        registerProcessGuards({ logger, exit, proc });
        proc.emit("uncaughtException", new Error("boom"));
        proc.emit("unhandledRejection", new Error("rejected"));
        expect(logger.fatal).toHaveBeenCalledTimes(2);
        expect(exit).toHaveBeenCalledTimes(2);
        expect(exit).toHaveBeenCalledWith(1);
    });
});
