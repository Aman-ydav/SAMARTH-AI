import { sanitizeInPlace } from "#utils/sanitize.js";

/**
 * Strips Mongo operator keys (`$...`), dotted keys and prototype keys from body, params and query, in place (BE-28).
 * `express-mongo-sanitize` and `hpp` assign `req.query`, which throws on Express 5, so they are not used.
 * Express 5 re-parses `req.query` on every read; the app installs `sanitizingQueryParser` so each read is already clean.
 * If a different parser is in use, the cleaned query object is pinned on the request as an own property.
 */
export function sanitizeInput() {
    return (req, _res, next) => {
        sanitizeInPlace(req.body);
        sanitizeInPlace(req.params);
        const query = req.query;
        if (sanitizeInPlace(query) > 0) {
            Object.defineProperty(req, "query", {
                value: query,
                writable: true,
                configurable: true,
                enumerable: true,
            });
        }
        next();
    };
}
