/** Normalises an email for lookup, storage and rate-limit keys: trim, NFKC, lowercase (AUTH-26). */
export const normalizeEmail = (email) =>
    String(email ?? "")
        .trim()
        .normalize("NFKC")
        .toLowerCase();

/** Length in UTF-8 bytes (bcrypt reads at most 72, R4). */
export const utf8ByteLength = (value) =>
    Buffer.byteLength(String(value ?? ""), "utf8");

/** Cuts a string to at most `max` UTF-16 units (user agents are kept to 200, AUTH-10). */
export const truncate = (value, max) => String(value ?? "").slice(0, max);

/** True when the text contains ASCII control characters (rejected in names and identifiers, EDGE-12). */
export const hasControlCharacters = (value) =>
    [...String(value ?? "")].some((char) => {
        const code = char.codePointAt(0);
        return code <= 0x1f || code === 0x7f;
    });

/** "ananya@example.test" becomes "a***@example.test": enough to recognise an address in a mail, not to reuse it. */
export function maskEmail(email) {
    const [local = "", domain = ""] = String(email ?? "").split("@");
    return `${[...local][0] ?? ""}***@${domain}`;
}
