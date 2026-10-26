import { describe, expect, it } from "vitest";
import {
    isUnsafeKey,
    sanitizeInPlace,
    sanitizingQueryParser,
} from "./sanitize.js";

describe("isUnsafeKey", () => {
    it.each(["$ne", "$where", "a.b", "__proto__", "constructor", "prototype"])(
        "flags %s",
        (key) => {
            expect(isUnsafeKey(key)).toBe(true);
        }
    );

    it.each(["email", "name", "a$b", "camelCase", "snake_case"])(
        "allows %s",
        (key) => {
            expect(isUnsafeKey(key)).toBe(false);
        }
    );
});

describe("sanitizeInPlace", () => {
    it("strips operator keys at the top level, mutating the same object", () => {
        const body = { email: "a@example.test", $where: "1==1" };
        const result = sanitizeInPlace(body);
        expect(result).toBe(1);
        expect(body).toEqual({ email: "a@example.test" });
    });

    it("strips nested operators and dotted keys, including inside arrays", () => {
        const body = {
            filter: { email: { $ne: null }, "a.b": 1 },
            list: [{ $gt: 1, ok: true }, "text", 3],
        };
        expect(sanitizeInPlace(body)).toBe(3);
        expect(body).toEqual({
            filter: { email: {} },
            list: [{ ok: true }, "text", 3],
        });
    });

    it("strips an own __proto__ key created by JSON.parse without polluting Object.prototype", () => {
        const body = JSON.parse('{"__proto__": {"admin": true}, "safe": 1}');
        expect(sanitizeInPlace(body)).toBe(1);
        expect(Object.keys(body)).toEqual(["safe"]);
        expect({}.admin).toBeUndefined();
    });

    it("works on null-prototype objects and ignores primitives and null", () => {
        const bare = Object.assign(Object.create(null), { $ne: 1, keep: 2 });
        expect(sanitizeInPlace(bare)).toBe(1);
        expect(Object.keys(bare)).toEqual(["keep"]);
        expect(sanitizeInPlace(null)).toBe(0);
        expect(sanitizeInPlace("string")).toBe(0);
        expect(sanitizeInPlace(undefined)).toBe(0);
    });

    it("survives cyclic structures and very deep nesting", () => {
        const cyclic = { a: { $x: 1 } };
        cyclic.self = cyclic;
        expect(sanitizeInPlace(cyclic)).toBe(1);

        let deep = { $bad: 1 };
        for (let i = 0; i < 50_000; i += 1) deep = { child: deep };
        expect(sanitizeInPlace(deep)).toBe(1);
    });

    it("leaves clean data untouched", () => {
        const body = { name: "A", tags: ["x", "y"], nested: { n: 1 } };
        expect(sanitizeInPlace(body)).toBe(0);
        expect(body).toEqual({ name: "A", tags: ["x", "y"], nested: { n: 1 } });
    });
});

describe("sanitizingQueryParser", () => {
    it("parses a query string and drops operator-like keys", () => {
        const parse = sanitizingQueryParser();
        expect({ ...parse("page=2&$where=1&a.b=2&name=x") }).toEqual({
            page: "2",
            name: "x",
        });
    });

    it("keeps repeated keys as arrays", () => {
        expect({ ...sanitizingQueryParser()("tag=a&tag=b") }).toEqual({
            tag: ["a", "b"],
        });
    });

    it("accepts a custom base parser", () => {
        const parse = sanitizingQueryParser(() => ({ ok: 1, $no: 2 }));
        expect(parse("ignored")).toEqual({ ok: 1 });
    });
});
