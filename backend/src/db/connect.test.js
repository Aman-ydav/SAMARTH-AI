import { EventEmitter } from "node:events";
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startTestDb, stopTestDb } from "#tests/helpers/testDb.js";
import {
    buildConnectOptions,
    connectDb,
    disconnectDb,
    getDbState,
    pingDb,
    registerDbEvents,
    runAsScript,
} from "./connect.js";

describe("buildConnectOptions (DB-34)", () => {
    it("fixes the pool, timeouts and write concern", () => {
        expect(
            buildConnectOptions({ dbName: "SamarthAI", isProduction: false })
        ).toEqual({
            dbName: "SamarthAI",
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45_000,
            maxPoolSize: 10,
            retryWrites: true,
            w: "majority",
            bufferCommands: false,
            autoIndex: true,
        });
    });

    it("turns autoIndex off in production (DB-25)", () => {
        expect(
            buildConnectOptions({ dbName: "x", isProduction: true }).autoIndex
        ).toBe(false);
    });
});

describe("connection lifecycle", () => {
    beforeAll(async () => {
        expect(getDbState()).toBe("disconnected");
        await startTestDb();
    });
    afterAll(stopTestDb);

    it("connects to a named database and reports the state", async () => {
        expect(getDbState()).toBe("connected");
        expect(mongoose.connection.name).toMatch(/^t[0-9a-f]{12}$/);
        expect(mongoose.get("sanitizeFilter")).toBe(true);
        expect(mongoose.get("strictQuery")).toBe(true);
    });

    it("pings the database", async () => {
        await expect(pingDb()).resolves.toBe(true);
    });

    it("pingDb is false when the ping hangs longer than the timeout", async () => {
        const original = mongoose.connection.db.admin;
        vi.spyOn(mongoose.connection.db, "admin").mockReturnValue({
            ping: () => new Promise(() => {}),
        });
        await expect(pingDb(20)).resolves.toBe(false);
        mongoose.connection.db.admin = original;
    });

    it("pingDb is false when the ping fails", async () => {
        vi.spyOn(mongoose.connection.db, "admin").mockReturnValue({
            ping: () => Promise.reject(new Error("down")),
        });
        await expect(pingDb()).resolves.toBe(false);
    });

    it("logs lifecycle events once per connection and never the URI", () => {
        const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const connection = Object.assign(new EventEmitter(), { name: "demo" });
        registerDbEvents(log, connection);
        registerDbEvents(log, connection);
        connection.emit("connected");
        connection.emit("disconnected");
        connection.emit("reconnected");
        connection.emit("error", new Error("boom"));
        expect(log.info).toHaveBeenCalledTimes(2);
        expect(log.warn).toHaveBeenCalledTimes(1);
        expect(log.error).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(log.info.mock.calls)).not.toContain("mongodb://");
    });
});

describe("disconnected behaviour", () => {
    it("pingDb is false and disconnect is a no-op when not connected", async () => {
        await disconnectDb();
        expect(getDbState()).toBe("disconnected");
        await expect(pingDb()).resolves.toBe(false);
        await expect(disconnectDb()).resolves.toBeUndefined();
    });

    it("connectDb rejects when the server is unreachable so the caller can exit non-zero", async () => {
        const log = { info() {}, warn() {}, error() {} };
        await expect(
            connectDb({
                uri: "mongodb://127.0.0.1:1",
                dbName: "x",
                isProduction: false,
                log,
            })
        ).rejects.toThrow();
    }, 20_000);
});

describe("runAsScript", () => {
    it("does nothing when the module is only imported", async () => {
        const main = vi.fn();
        const exit = vi.fn();
        await runAsScript("file:///elsewhere/other.js", main, {
            exit,
            argv: ["node", "/some/script.js"],
        });
        expect(main).not.toHaveBeenCalled();
        expect(exit).not.toHaveBeenCalled();
    });

    it("does nothing without an entry script", async () => {
        const exit = vi.fn();
        await runAsScript("file:///x.js", vi.fn(), { exit, argv: ["node"] });
        expect(exit).not.toHaveBeenCalled();
    });

    it("runs main between connect and disconnect, passes the CLI arguments and exits 0", async () => {
        const script = "/app/src/db/example.js";
        const order = [];
        const exit = vi.fn();
        await runAsScript(
            pathToFileURL(script).href,
            async (args) => order.push(`main:${args.join(",")}`),
            {
                exit,
                argv: ["node", script, "--apply"],
                connect: async () => order.push("connect"),
                disconnect: async () => order.push("disconnect"),
            }
        );
        expect(order).toEqual(["connect", "main:--apply", "disconnect"]);
        expect(exit).toHaveBeenCalledWith(0);
    });

    it("exits 1 and still disconnects when main throws", async () => {
        const script = "/app/src/db/example.js";
        const exit = vi.fn();
        const disconnect = vi.fn();
        await runAsScript(
            pathToFileURL(script).href,
            async () => {
                throw new Error("fail");
            },
            {
                exit,
                argv: ["node", script],
                connect: async () => {},
                disconnect,
            }
        );
        expect(exit).toHaveBeenCalledWith(1);
        expect(disconnect).toHaveBeenCalled();
    });
});
