import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { sanitizingQueryParser } from "#utils/sanitize.js";
import { sanitizeInput } from "./sanitizeInput.js";

/** `withParser` mirrors the production app; without it Express 5 uses its default simple parser. */
function appWith({ withParser }) {
    const app = express();
    if (withParser) app.set("query parser", sanitizingQueryParser());
    app.use(express.json());
    app.use(sanitizeInput());
    app.all("/echo", (req, res) =>
        res.json({
            query: { ...req.query },
            body: req.body ?? null,
            queryAgain: { ...req.query },
        })
    );
    return app;
}

describe.each([
    ["with the sanitising query parser (production setup)", true],
    ["with the default Express 5 parser (fallback pin)", false],
])("sanitizeInput %s", (_label, withParser) => {
    const app = appWith({ withParser });

    it("strips operator and dotted keys from the query without throwing on read-only req.query", async () => {
        const res = await request(app).get(
            "/echo?ok=1&$where=sleep(1000)&a.b=2&$ne=x"
        );
        expect(res.status).toBe(200);
        expect(res.body.query).toEqual({ ok: "1" });
    });

    it("keeps the cleaned query on every later read of req.query (Express 5 re-parses it)", async () => {
        const res = await request(app).get("/echo?ok=1&$gt=5");
        expect(res.body.queryAgain).toEqual({ ok: "1" });
    });

    it("leaves a clean query alone", async () => {
        const res = await request(app).get("/echo?page=2&tag=a&tag=b");
        expect(res.body.query).toEqual({ page: "2", tag: ["a", "b"] });
    });

    it("strips NoSQL injection operators from JSON bodies, including nested ones", async () => {
        const res = await request(app)
            .post("/echo")
            .send({
                email: { $ne: null },
                password: { $gt: "" },
                profile: { "name.first": "x", ok: true },
                $where: "1",
            });
        expect(res.body.body).toEqual({
            email: {},
            password: {},
            profile: { ok: true },
        });
    });

    it("strips an own __proto__ key from JSON without polluting the prototype", async () => {
        const res = await request(app)
            .post("/echo")
            .set("Content-Type", "application/json")
            .send('{"__proto__":{"admin":true},"a":1}');
        expect(res.body.body).toEqual({ a: 1 });
        expect({}.admin).toBeUndefined();
    });

    it("copes with a request that has no body", async () => {
        const res = await request(app).get("/echo");
        expect(res.body.body).toBeNull();
    });
});
