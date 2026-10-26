import { createHash } from "node:crypto";

/**
 * Stand-in for `bcryptjs` in tests that exercise flows, not hashing (TEST-28: real cost-12 bcrypt takes about a second
 * per call). It keeps the shape callers rely on: hashes look like `$2b$12$...` (60 characters), `compare` is async,
 * a different password never matches, and the fixed dummy hash of the password service never matches anything.
 * Use it with `vi.mock("bcryptjs", ...)`; password.service.test.js and the lifecycle test keep the real library.
 *
 *     vi.mock("bcryptjs", async () => (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock());
 */
const digest = (password) =>
    createHash("sha256")
        .update(`fast-bcrypt:${password}`)
        .digest("base64url")
        .padEnd(53, "0")
        .slice(0, 53);

const hashSync = (password, cost = 12) =>
    `$2b$${String(cost).padStart(2, "0")}$${digest(password)}`;

export const fastBcrypt = {
    hashSync,
    hash: async (password, cost) => hashSync(password, cost),
    compare: async (password, stored) =>
        typeof stored === "string" &&
        stored.startsWith("$2b$") &&
        hashSync(password, Number(stored.slice(4, 6))) === stored,
};

export const fastBcryptMock = async () => ({ default: fastBcrypt });
