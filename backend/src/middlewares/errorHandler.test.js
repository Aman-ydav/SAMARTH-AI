import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import multer from "multer";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError } from "#utils/apiError.js";
import { createErrorHandler } from "./errorHandler.js";

function run(
    error,
    { isDevelopment = false, req = {}, headersSent = false } = {}
) {
    const log = { error: vi.fn(), warn: vi.fn() };
    const res = {
        headersSent,
        locals: {},
        headers: {},
        setHeader(name, value) {
            this.headers[name] = value;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
    const next = vi.fn();
    createErrorHandler({ isDevelopment, log })(
        error,
        { id: "req-12345678", ...req },
        res,
        next
    );
    return { res, next, log, body: res.body };
}

const personSchema = new mongoose.Schema({
    name: { type: String, required: "NAME_REQUIRED" },
    email: { type: String, minlength: 5 },
});
const Person = mongoose.model("ErrPerson", personSchema, "errPeople");

describe("envelope (BE-30, R35)", () => {
    it("renders an ApiError with its own status, code, message and errors plus the request id", () => {
        const { res, body } = run(
            ApiError.conflict("CONFLICT", {
                message: "Taken",
                errors: [{ field: "email", message: "Already exists" }],
            })
        );
        expect(res.statusCode).toBe(409);
        expect(body).toEqual({
            statusCode: 409,
            success: false,
            message: "Taken",
            code: "CONFLICT",
            errors: [{ field: "email", message: "Already exists" }],
            data: null,
            requestId: "req-12345678",
        });
        expect(res.headers["Cache-Control"]).toBe("no-store");
    });

    it("falls back to the request id on res.locals", () => {
        const { body } = run(ApiError.notFound(), { req: { id: undefined } });
        expect(body.requestId).toBeUndefined();
        const res = {
            locals: { requestId: "from-locals" },
            setHeader() {},
            status() {
                return this;
            },
            json(payload) {
                this.body = payload;
                return this;
            },
        };
        createErrorHandler({
            isDevelopment: false,
            log: { error() {}, warn() {} },
        })(ApiError.notFound(), {}, res, vi.fn());
        expect(res.body.requestId).toBe("from-locals");
    });

    it("sends Retry-After and retryAfterSec for rate limits and lockouts (EDGE-71)", () => {
        const { res, body } = run(
            ApiError.locked("ACCOUNT_LOCKED", { retryAfterSec: 900 })
        );
        expect(res.statusCode).toBe(423);
        expect(res.headers["Retry-After"]).toBe("900");
        expect(body.retryAfterSec).toBe(900);
    });

    it("delegates to next(err) when headers were already sent (BE-31)", () => {
        const error = new Error("late");
        const { next, res } = run(error, { headersSent: true });
        expect(next).toHaveBeenCalledWith(error);
        expect(res.body).toBeUndefined();
    });

    it("adds the stack only in development", () => {
        expect(
            run(new Error("x"), { isDevelopment: true }).body.stack
        ).toContain("Error: x");
        expect(
            run(new Error("x"), { isDevelopment: false }).body
        ).not.toHaveProperty("stack");
    });
});

describe("mapping table (rule 03 section 4)", () => {
    const status = (error) => {
        const { res, body } = run(error);
        return [res.statusCode, body.code];
    };

    it("ZodError -> 400 VALIDATION_ERROR with one entry per issue and no values", () => {
        const result = z
            .object({ email: z.string().email(), age: z.number().min(18) })
            .safeParse({ email: "secret@bad", age: 3 });
        const { res, body } = run(result.error);
        expect([res.statusCode, body.code]).toEqual([400, "VALIDATION_ERROR"]);
        expect(body.errors.map((e) => e.field).sort()).toEqual([
            "age",
            "email",
        ]);
        expect(JSON.stringify(body)).not.toContain("secret@bad");
    });

    it("ZodError unknown keys become one entry per key", () => {
        const result = z
            .strictObject({ a: z.string() })
            .safeParse({ a: "x", role: "admin", orgId: "1" });
        expect(run(result.error).body.errors.map((e) => e.field)).toEqual([
            "role",
            "orgId",
        ]);
    });

    it("Mongoose ValidationError -> 400 VALIDATION_ERROR keeping stable message codes and hiding values", async () => {
        const error = await new Person({ email: "x@y" })
            .validate()
            .catch((failure) => failure);
        const { res, body } = run(error);
        expect(res.statusCode).toBe(400);
        expect(body.code).toBe("VALIDATION_ERROR");
        expect(body.errors).toEqual(
            expect.arrayContaining([
                {
                    field: "name",
                    message: "NAME_REQUIRED",
                    code: "NAME_REQUIRED",
                },
                { field: "email", message: "Invalid value", code: "minlength" },
            ])
        );
        expect(JSON.stringify(body)).not.toContain("x@y");
    });

    it("CastError for an ObjectId -> 400 INVALID_ID", async () => {
        const error = await Person.findById("not-an-id")
            .exec()
            .catch((failure) => failure);
        const { res, body } = run(error);
        expect([res.statusCode, body.code]).toEqual([400, "INVALID_ID"]);
        expect(body.errors[0]).toMatchObject({
            field: "id",
            code: "INVALID_ID",
        });
        expect(JSON.stringify(body)).not.toContain("not-an-id");
    });

    it("CastError for another type -> 400 VALIDATION_ERROR", () => {
        const error = new mongoose.Error.CastError(
            "Date",
            "yesterday",
            "createdAt"
        );
        expect(status(error)).toEqual([400, "VALIDATION_ERROR"]);
    });

    it("duplicate key 11000 -> 409 CONFLICT naming the field but never the value", () => {
        const error = Object.assign(
            new Error(
                'E11000 duplicate key error collection: x index: users_email_uq dup key: { email: "a@b.test" }'
            ),
            {
                name: "MongoServerError",
                code: 11000,
                keyPattern: { email: 1 },
                keyValue: { email: "a@b.test" },
            }
        );
        const { res, body } = run(error);
        expect([res.statusCode, body.code]).toEqual([409, "CONFLICT"]);
        expect(body.errors).toEqual([
            { field: "email", message: "Already exists", code: "CONFLICT" },
        ]);
        expect(JSON.stringify(body)).not.toMatch(
            /a@b\.test|E11000|users_email_uq/
        );
    });

    it("duplicate key without details still maps to 409", () => {
        expect(
            status(Object.assign(new Error("dup"), { code: 11000 }))
        ).toEqual([409, "CONFLICT"]);
    });

    it("optimistic-concurrency VersionError -> 409 CONFLICT (EDGE-31)", () => {
        expect(
            status(
                Object.assign(new Error("No matching document"), {
                    name: "VersionError",
                })
            )
        ).toEqual([409, "CONFLICT"]);
    });

    it("JWT errors -> 401 TOKEN_EXPIRED / TOKEN_INVALID without leaking details", () => {
        const secret = "s".repeat(40);
        const expired = jwt.sign({ sub: "1" }, secret, { expiresIn: -10 });
        const tryVerify = (token) => {
            try {
                jwt.verify(token, secret, { algorithms: ["HS256"] });
            } catch (error) {
                return error;
            }
            return null;
        };
        expect(status(tryVerify(expired))).toEqual([401, "TOKEN_EXPIRED"]);
        expect(status(tryVerify("garbage.token.value"))).toEqual([
            401,
            "TOKEN_INVALID",
        ]);
        expect(
            status(
                tryVerify(
                    jwt.sign(
                        { sub: "1" },
                        "other-secret-other-secret-other-secret"
                    )
                )
            )
        ).toEqual([401, "TOKEN_INVALID"]);
        expect(
            JSON.stringify(run(tryVerify("garbage.token.value")).body)
        ).not.toMatch(/jwt|malformed/i);
    });

    it("MulterError LIMIT_FILE_SIZE -> 413 FILE_TOO_LARGE", () => {
        expect(
            status(new multer.MulterError("LIMIT_FILE_SIZE", "file"))
        ).toEqual([413, "FILE_TOO_LARGE"]);
    });

    it.each([
        "LIMIT_FILE_COUNT",
        "LIMIT_UNEXPECTED_FILE",
        "LIMIT_FIELD_COUNT",
        "LIMIT_PART_COUNT",
        "LIMIT_FIELD_VALUE",
    ])("MulterError %s -> 400 UPLOAD_INVALID", (code) => {
        expect(status(new multer.MulterError(code, "file"))).toEqual([
            400,
            "UPLOAD_INVALID",
        ]);
    });

    it("database unavailable -> 503 INTEGRATION_ERROR with Retry-After (EDGE-54)", () => {
        const { res, body } = run(
            Object.assign(new Error("connect ECONNREFUSED 10.0.0.1:27017"), {
                name: "MongooseServerSelectionError",
            })
        );
        expect([res.statusCode, body.code]).toEqual([503, "INTEGRATION_ERROR"]);
        expect(res.headers["Retry-After"]).toBe("5");
        expect(JSON.stringify(body)).not.toContain("10.0.0.1");
    });

    it("body-parser errors: syntax -> INVALID_JSON, too large -> PAYLOAD_TOO_LARGE, unsupported charset -> 415", () => {
        const syntax = Object.assign(
            new SyntaxError("Unexpected token } in JSON at position 5"),
            { status: 400, type: "entity.parse.failed", expose: true }
        );
        expect(status(syntax)).toEqual([400, "INVALID_JSON"]);
        expect(
            status(
                Object.assign(new Error("request entity too large"), {
                    status: 413,
                    type: "entity.too.large",
                    expose: true,
                })
            )
        ).toEqual([413, "PAYLOAD_TOO_LARGE"]);
        expect(
            status(
                Object.assign(new Error("unsupported charset"), {
                    status: 415,
                    type: "charset.unsupported",
                    expose: true,
                })
            )
        ).toEqual([415, "UNSUPPORTED_MEDIA_TYPE"]);
        expect(
            status(
                Object.assign(new Error("request aborted"), {
                    status: 400,
                    type: "request.aborted",
                })
            )
        ).toEqual([400, "BAD_REQUEST"]);
    });

    it("a malformed URL parameter (URIError) -> 400 BAD_REQUEST", () => {
        expect(status(new URIError("URI malformed"))).toEqual([
            400,
            "BAD_REQUEST",
        ]);
    });

    it("anything else -> generic 500 INTERNAL with no leak", () => {
        const { res, body, log } = run(
            new TypeError(
                "Cannot read properties of undefined (reading 'passwordHash') at /srv/app/secret.js:12"
            )
        );
        expect([res.statusCode, body.code, body.message]).toEqual([
            500,
            "INTERNAL",
            "Something went wrong.",
        ]);
        expect(body.errors).toEqual([]);
        expect(JSON.stringify(body)).not.toMatch(
            /passwordHash|secret\.js|TypeError|stack/
        );
        expect(log.error).toHaveBeenCalledOnce();
    });

    it.each([
        ["a string", "boom"],
        ["undefined", undefined],
        ["null", null],
        ["a number", 42],
    ])("survives a thrown %s", (_label, thrown) => {
        expect(status(thrown)).toEqual([500, "INTERNAL"]);
    });

    it("answers a non-operational ApiError with the generic 500 (BE-31)", () => {
        const { body } = run(
            ApiError.internal("INTERNAL", {
                message: "template bug: missing variable x",
                isOperational: false,
            })
        );
        expect(body.message).toBe("Something went wrong.");
        expect(JSON.stringify(body)).not.toContain("template bug");
    });
});

describe("logging (BE-30)", () => {
    it("logs 5xx at error level with the cause and 4xx at warn level without messages", () => {
        const failure = run(new Error("db exploded"));
        expect(failure.log.error).toHaveBeenCalledOnce();
        expect(failure.log.warn).not.toHaveBeenCalled();
        const rejected = run(
            ApiError.unauthorized("INVALID_CREDENTIALS", {
                message: "bad password for asha@example.test",
            })
        );
        expect(rejected.log.warn).toHaveBeenCalledOnce();
        expect(rejected.log.error).not.toHaveBeenCalled();
        expect(JSON.stringify(rejected.log.warn.mock.calls)).not.toContain(
            "asha@example.test"
        );
        expect(rejected.log.warn.mock.calls[0][0]).toMatchObject({
            code: "INVALID_CREDENTIALS",
            statusCode: 401,
            requestId: "req-12345678",
        });
    });

    it("prefers the per-request logger", () => {
        const reqLog = { error: vi.fn(), warn: vi.fn() };
        const { log } = run(ApiError.notFound(), { req: { log: reqLog } });
        expect(reqLog.warn).toHaveBeenCalledOnce();
        expect(log.warn).not.toHaveBeenCalled();
    });
});
