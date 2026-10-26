import { randomUUID } from "node:crypto";

const VALID_ID = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * First middleware (BE-02, BE-82): accepts an incoming `X-Request-Id` only if it is 8-64 safe characters, otherwise
 * generates a UUID. The id is on `req.id`, `res.locals.requestId`, the response header, logs and error bodies.
 */
export function requestId() {
    return (req, res, next) => {
        const incoming = req.headers["x-request-id"];
        const id =
            typeof incoming === "string" && VALID_ID.test(incoming)
                ? incoming
                : randomUUID();
        req.id = id;
        res.locals.requestId = id;
        res.setHeader("X-Request-Id", id);
        next();
    };
}
