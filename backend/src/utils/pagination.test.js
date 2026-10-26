import { describe, expect, it } from "vitest";
import {
    buildPageMeta,
    PAGINATION,
    paginationQueryShape,
    parsePagination,
} from "./pagination.js";

const options = { allowedSort: ["createdAt", "name"] };

describe("parsePagination", () => {
    it("uses defaults when the query is empty", () => {
        expect(parsePagination({}, options)).toMatchObject({
            page: 1,
            limit: 20,
            skip: 0,
            sortField: "createdAt",
            order: "desc",
        });
    });

    it("returns a sort with an _id tiebreaker in the same direction (EDGE-42)", () => {
        expect(
            parsePagination({ sort: "name", order: "asc" }, options).sort
        ).toEqual({ name: 1, _id: 1 });
        expect(parsePagination({ sort: "name" }, options).sort).toEqual({
            name: -1,
            _id: -1,
        });
    });

    it("computes skip from page and limit", () => {
        expect(
            parsePagination({ page: "3", limit: "10" }, options)
        ).toMatchObject({ page: 3, limit: 10, skip: 20 });
    });

    it.each([["0"], ["-4"], ["abc"], ["1.5"], [""], [undefined]])(
        "falls back to page 1 for %j",
        (page) => {
            expect(parsePagination({ page }, options).page).toBe(1);
        }
    );

    it("clamps the limit to the maximum and falls back for junk", () => {
        expect(parsePagination({ limit: "5000" }, options).limit).toBe(
            PAGINATION.MAX_LIMIT
        );
        expect(parsePagination({ limit: "0" }, options).limit).toBe(
            PAGINATION.DEFAULT_LIMIT
        );
        expect(parsePagination({ limit: "x" }, options).limit).toBe(
            PAGINATION.DEFAULT_LIMIT
        );
        expect(
            parsePagination({ limit: "500" }, { ...options, maxLimit: 50 })
                .limit
        ).toBe(50);
    });

    it("rejects a sort field outside the whitelist with VALIDATION_ERROR", () => {
        expect(() =>
            parsePagination({ sort: "passwordHash" }, options)
        ).toThrowError(
            expect.objectContaining({
                code: "VALIDATION_ERROR",
                statusCode: 400,
            })
        );
        expect(() => parsePagination({ sort: "__proto__" }, options)).toThrow();
        expect(() => parsePagination({ sort: "toString" }, options)).toThrow();
    });

    it("rejects an order other than asc or desc", () => {
        expect(() =>
            parsePagination({ order: "sideways" }, options)
        ).toThrowError(expect.objectContaining({ code: "VALIDATION_ERROR" }));
    });

    it("maps public sort names to database fields", () => {
        const parsed = parsePagination(
            { sort: "joined" },
            { allowedSort: { joined: "createdAt" } }
        );
        expect(parsed.sortField).toBe("createdAt");
    });

    it("allows the default sort field even when it is not whitelisted", () => {
        expect(
            parsePagination(
                {},
                { allowedSort: ["name"], defaultSort: "createdAt" }
            ).sortField
        ).toBe("createdAt");
    });

    it("refuses pages deeper than the skip cap", () => {
        expect(() =>
            parsePagination({ page: "600", limit: "20" }, options)
        ).toThrowError(expect.objectContaining({ code: "VALIDATION_ERROR" }));
        expect(
            parsePagination({ page: "501", limit: "20" }, options).skip
        ).toBe(10_000);
    });
});

describe("buildPageMeta", () => {
    it("reports totals and hasNext", () => {
        expect(buildPageMeta({ page: 1, limit: 20, total: 45 })).toEqual({
            page: 1,
            limit: 20,
            total: 45,
            totalPages: 3,
            hasNext: true,
        });
        expect(buildPageMeta({ page: 3, limit: 20, total: 45 }).hasNext).toBe(
            false
        );
    });

    it("handles an empty set and a page beyond the last", () => {
        expect(buildPageMeta({ page: 1, limit: 20, total: 0 })).toMatchObject({
            totalPages: 0,
            hasNext: false,
        });
        expect(buildPageMeta({ page: 9, limit: 20, total: 5 })).toMatchObject({
            totalPages: 1,
            hasNext: false,
        });
    });
});

describe("paginationQueryShape", () => {
    it("exposes optional string fields for endpoint query schemas", () => {
        expect(Object.keys(paginationQueryShape)).toEqual([
            "page",
            "limit",
            "sort",
            "order",
        ]);
    });
});
