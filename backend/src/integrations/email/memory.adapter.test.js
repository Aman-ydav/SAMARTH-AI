import { describe, expect, it } from "vitest";
import {
    createMemoryTransport,
    linksOf,
    toOutboxView,
    tokenOf,
} from "./memory.adapter.js";

const mail = (overrides = {}) => ({
    to: "asha@example.test",
    templateKey: "verify-email",
    lang: "en",
    subject: "Subject",
    text: "Body",
    data: {
        name: "Asha",
        link: "https://app.example.test/verify-email#token=tok-1",
    },
    ...overrides,
});

describe("memory transport (TEST-24)", () => {
    it("captures messages with an id and timestamp", async () => {
        const transport = createMemoryTransport();
        const { messageId } = await transport.send(mail());
        expect(transport.name).toBe("memory");
        expect(transport.all()).toHaveLength(1);
        expect(transport.all()[0]).toMatchObject({
            id: messageId,
            to: "asha@example.test",
            templateKey: "verify-email",
        });
        expect(new Date(transport.all()[0].sentAt).toString()).not.toBe(
            "Invalid Date"
        );
    });

    it("finds by recipient and template, newest last", async () => {
        const transport = createMemoryTransport();
        await transport.send(mail());
        await transport.send(mail({ templateKey: "welcome" }));
        await transport.send(mail({ to: "ravi@example.test" }));
        expect(transport.find({ to: "asha@example.test" })).toHaveLength(2);
        expect(transport.find({ templateKey: "welcome" })).toHaveLength(1);
        expect(
            transport.find({
                to: "asha@example.test",
                templateKey: "verify-email",
            })
        ).toHaveLength(1);
        expect(transport.latest({ to: "asha@example.test" }).templateKey).toBe(
            "welcome"
        );
        expect(transport.latest({ to: "nobody@example.test" })).toBeUndefined();
    });

    it("clears and bounds the outbox", async () => {
        const transport = createMemoryTransport({ limit: 2 });
        for (const subject of ["a", "b", "c"])
            await transport.send(mail({ subject }));
        expect(transport.all().map((item) => item.subject)).toEqual(["b", "c"]);
        transport.clear();
        expect(transport.all()).toEqual([]);
    });

    it("returns copies so tests cannot corrupt the store", async () => {
        const transport = createMemoryTransport();
        await transport.send(mail());
        transport.all().pop();
        expect(transport.all()).toHaveLength(1);
    });
});

describe("outbox helpers", () => {
    it("extracts links and the fragment token", () => {
        expect(linksOf(mail())).toEqual([
            "https://app.example.test/verify-email#token=tok-1",
        ]);
        expect(tokenOf(mail())).toBe("tok-1");
        expect(tokenOf(mail({ data: { name: "Asha" } }))).toBeNull();
        expect(tokenOf(undefined)).toBeNull();
    });

    it("builds the view served by the test outbox without the HTML or raw variables", () => {
        const view = toOutboxView({
            id: "1",
            sentAt: "now",
            html: "<p>x</p>",
            ...mail(),
        });
        expect(view).toEqual({
            id: "1",
            to: "asha@example.test",
            templateKey: "verify-email",
            lang: "en",
            subject: "Subject",
            text: "Body",
            links: ["https://app.example.test/verify-email#token=tok-1"],
            token: "tok-1",
            sentAt: "now",
        });
    });
});
