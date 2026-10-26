import querystring from "node:querystring";

const PROTOTYPE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** A key is unsafe when it starts with `$` (Mongo operator), contains `.` (path traversal) or targets the prototype. */
export const isUnsafeKey = (key) =>
    key.startsWith("$") || key.includes(".") || PROTOTYPE_KEYS.has(key);

/**
 * Deletes unsafe keys from `value` and every nested object or array, mutating in place (BE-28).
 * Iterative, so a deeply nested payload cannot overflow the stack. Returns how many keys were removed.
 */
export function sanitizeInPlace(value) {
    if (value === null || typeof value !== "object") return 0;
    let removed = 0;
    const seen = new WeakSet([value]);
    const stack = [value];
    while (stack.length > 0) {
        const current = stack.pop();
        if (!Array.isArray(current)) {
            for (const key of Object.keys(current)) {
                if (isUnsafeKey(key)) {
                    delete current[key];
                    removed += 1;
                }
            }
        }
        for (const child of Object.values(current)) {
            if (
                child !== null &&
                typeof child === "object" &&
                !seen.has(child)
            ) {
                seen.add(child);
                stack.push(child);
            }
        }
    }
    return removed;
}

/**
 * Query-string parser for `app.set("query parser", ...)`. Express 5 re-parses `req.query` on every read, so stripping
 * the returned object afterwards would be lost; sanitising inside the parser makes every read safe.
 */
export function sanitizingQueryParser(parse = querystring.parse) {
    return (text) => {
        const parsed = parse(text);
        sanitizeInPlace(parsed);
        return parsed;
    };
}
