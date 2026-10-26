import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { expectError } from "#tests/helpers/envelopes.js";
import { createLogger } from "#utils/logger.js";
import { createErrorHandler } from "./errorHandler.js";
import { requestId } from "./requestId.js";
import { validate } from "./validate.js";

const silent = createLogger({ level: "silent", isDevelopment: false });
function appWith(schemas, options) {
    const app = express();
    app.use(requestId());
    app.use(express.json());
    app.all("/items/:id", validate(schemas, options), (req, res) =>
        res.json({ validated: req.validated, body: req.body })
    );
    app.use(createErrorHandler({ isDevelopment: false, log: silent }));
    return app;
}

const schemas = {
    params: z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) }),
    query: z.object({ page: z.coerce.number().int().min(1).default(1) }),
    body: z.object({
        name: z.string().trim().min(2).max(20),
        age: z.number().int().min(0).optional(),
    }),
};
const ID = "507f1f77bcf86cd799439011";

describe("validate (BE-23)", () => {
    it("parses params, query and body, coerces types and exposes them on req.validated", async () => {
        const res = await request(appWith(schemas))
            .post(`/items/${ID}?page=3`)
            .send({ name: "  Asha  " });
        expect(res.status).toBe(200);
        expect(res.body.validated).toEqual({
            params: { id: ID },
            query: { page: 3 },
            body: { name: "Asha" },
        });
        expect(res.body.body).toEqual({ name: "Asha" });
    });

    it("applies schema defaults for missing query values", async () => {
        const res = await request(appWith(schemas))
            .post(`/items/${ID}`)
            .send({ name: "Asha" });
        expect(res.body.validated.query).toEqual({ page: 1 });
    });

    it("only validates the parts that have a schema", async () => {
        const res = await request(appWith({ query: schemas.query }))
            .post(`/items/${ID}?page=2`)
            .send({ anything: true });
        expect(res.body.validated).toEqual({ query: { page: 2 } });
    });

    it("returns 400 VALIDATION_ERROR with one entry per field and never echoes the submitted values", async () => {
        const res = await request(appWith(schemas))
            .post(`/items/${ID}`)
            .send({ name: "x", age: "secret-value-123" });
        const body = expectError(res, 400, "VALIDATION_ERROR");
        expect(body.errors.map((e) => e.field).sort()).toEqual(["age", "name"]);
        expect(body.errors.every((e) => e.message && e.code)).toBe(true);
        expect(JSON.stringify(body)).not.toContain("secret-value-123");
    });

    it("collects problems from all parts and prefixes query and params fields", async () => {
        const res = await request(appWith(schemas))
            .post("/items/not-an-id?page=0")
            .send({ name: "x" });
        const fields = expectError(res, 400, "VALIDATION_ERROR").errors.map(
            (e) => e.field
        );
        expect(fields).toEqual(
            expect.arrayContaining(["params.id", "query.page", "name"])
        );
    });

    it("treats a missing body as an empty object", async () => {
        const res = await request(appWith(schemas)).get(`/items/${ID}`);
        expect(expectError(res, 400, "VALIDATION_ERROR").errors[0].field).toBe(
            "name"
        );
    });

    it("rejects a JSON array where an object is expected", async () => {
        const res = await request(appWith(schemas))
            .post(`/items/${ID}`)
            .set("Content-Type", "application/json")
            .send("[]");
        expectError(res, 400, "VALIDATION_ERROR");
    });

    it.each([["null"], ['"text"'], ["42"]])(
        "rejects the non-container JSON body %s at the parser (strict mode)",
        async (payload) => {
            const res = await request(appWith(schemas))
                .post(`/items/${ID}`)
                .set("Content-Type", "application/json")
                .send(payload);
            expectError(res, 400, "INVALID_JSON");
        }
    );
});

describe("unknown keys", () => {
    it("rejects unknown body keys by default so role, orgId and status cannot be mass-assigned", async () => {
        const res = await request(appWith(schemas))
            .post(`/items/${ID}`)
            .send({ name: "Asha", role: "admin", orgId: "1" });
        const body = expectError(res, 400, "VALIDATION_ERROR");
        expect(body.errors).toEqual(
            expect.arrayContaining([
                {
                    field: "role",
                    message: "Unknown field",
                    code: "unrecognized_keys",
                },
                {
                    field: "orgId",
                    message: "Unknown field",
                    code: "unrecognized_keys",
                },
            ])
        );
    });

    it("rejects unknown query keys by default (EDGE-43)", async () => {
        const res = await request(appWith(schemas))
            .post(`/items/${ID}?page=1&debug=1`)
            .send({ name: "Asha" });
        expect(expectError(res, 400, "VALIDATION_ERROR").errors[0].field).toBe(
            "query.debug"
        );
    });

    it("can strip instead of reject when asked", async () => {
        const res = await request(appWith(schemas, { unknownKeys: "strip" }))
            .post(`/items/${ID}?debug=1`)
            .send({ name: "Asha", role: "admin" });
        expect(res.status).toBe(200);
        expect(res.body.validated.body).toEqual({ name: "Asha" });
    });

    it("respects a schema that explicitly chose to be loose or strict", async () => {
        const loose = { body: z.looseObject({ name: z.string() }) };
        const res = await request(appWith(loose))
            .post(`/items/${ID}`)
            .send({ name: "A", extra: 1 });
        expect(res.body.validated.body).toEqual({ name: "A", extra: 1 });
    });

    it("leaves non-object schemas untouched", async () => {
        const res = await request(appWith({ body: z.array(z.string()) }))
            .post(`/items/${ID}`)
            .send(["a", "b"]);
        expect(res.body.validated.body).toEqual(["a", "b"]);
    });
});

describe("validation details", () => {
    it("supports async refinements", async () => {
        const body = z
            .object({ code: z.string() })
            .refine(async (value) => value.code !== "taken", {
                message: "Code is taken",
                path: ["code"],
            });
        const res = await request(appWith({ body }))
            .post(`/items/${ID}`)
            .send({ code: "taken" });
        expect(
            expectError(res, 400, "VALIDATION_ERROR").errors[0]
        ).toMatchObject({ field: "code", message: "Code is taken" });
    });

    it("reports nested field paths with dots", async () => {
        const body = z.object({
            profile: z.object({ phone: z.string().min(10) }),
        });
        const res = await request(appWith({ body }))
            .post(`/items/${ID}`)
            .send({ profile: { phone: "1" } });
        expect(expectError(res, 400, "VALIDATION_ERROR").errors[0].field).toBe(
            "profile.phone"
        );
    });

    it("keeps Unicode text and rejects bad enums", async () => {
        const body = z.object({
            name: z.string(),
            locale: z.enum(["en", "hi"]),
        });
        expect(
            (
                await request(appWith({ body }))
                    .post(`/items/${ID}`)
                    .send({ name: "आशा 😀", locale: "hi" })
            ).body.validated.body.name
        ).toBe("आशा 😀");
        expectError(
            await request(appWith({ body }))
                .post(`/items/${ID}`)
                .send({ name: "x", locale: "fr" }),
            400,
            "VALIDATION_ERROR"
        );
    });
});
