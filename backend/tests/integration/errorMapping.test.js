import { describe, expect, it } from "vitest";
import { buildApp, request } from "#tests/helpers/appFactory.js";
import { expectError } from "#tests/helpers/envelopes.js";
import { errorHandler, toApiError } from "#middlewares/errorHandler.js";
import { ApiError } from "#utils/apiError.js";

describe("through the real app (Supertest)", () => {
    const mountRoutes = (api) => {
        api.get("/boom", () => {
            throw new TypeError("internal detail /srv/secret");
        });
        api.get("/async-boom", async () => {
            throw new Error("async detail");
        });
    };

    it("answers a synchronous throw with the generic 500 envelope", async () => {
        const res = await request(buildApp({ mountRoutes }).app).get(
            "/api/v1/boom"
        );
        const body = expectError(res, 500, "INTERNAL");
        expect(JSON.stringify(body)).not.toMatch(
            /internal detail|secret|TypeError/
        );
        expect(body).not.toHaveProperty("stack");
    });

    it("includes the stack in development only", async () => {
        const development = await request(
            buildApp({ env: { NODE_ENV: "development" }, mountRoutes }).app
        ).get("/api/v1/boom");
        expect(development.body.stack).toContain("internal detail");
        const production = await request(
            buildApp({ env: { NODE_ENV: "production" }, mountRoutes }).app
        ).get("/api/v1/boom");
        expect(production.body).not.toHaveProperty("stack");
    });

    it("answers an async rejection too (Express 5 forwards it)", async () => {
        expectError(
            await request(buildApp({ mountRoutes }).app).get(
                "/api/v1/async-boom"
            ),
            500,
            "INTERNAL"
        );
    });
});

describe("exports used by the app", () => {
    it("exposes a ready-made four-argument handler and an ApiError-preserving mapper", () => {
        const error = ApiError.forbidden();
        expect(errorHandler.length).toBe(4);
        expect(toApiError(error)).toBe(error);
    });
});
