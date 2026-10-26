import { errorMessageKey } from "@/lib/apiError";

/** UTF-8 byte length of a string: the password limit counts bytes, not characters (R4, FE-75). */
export function utf8ByteLength(value) {
    const text = typeof value === "string" ? value : "";
    let bytes = 0;
    for (const char of text) {
        const point = char.codePointAt(0);
        if (point < 0x80) bytes += 1;
        else if (point < 0x800) bytes += 2;
        else if (point < 0x10000) bytes += 3;
        else bytes += 4;
    }
    return bytes;
}

/** Number of Unicode code points (so an emoji counts once, unlike String.length). */
export function codePointLength(value) {
    return typeof value === "string" ? Array.from(value).length : 0;
}

/**
 * Maps a normalised ApiError onto a react-hook-form instance (FE-76).
 * Field errors go to their field when the field is known; everything else becomes the form-level
 * `root.server` error whose message is an i18n key. Focuses the first errored field.
 * Returns `{ fieldCount, formErrorCode }`.
 */
export function applyServerErrors(
    apiError,
    { setError, setFocus, fields = [] } = {}
) {
    const known = new Set(fields);
    let firstField = null;
    let fieldCount = 0;

    for (const item of apiError?.errors ?? []) {
        if (!item?.field || !known.has(item.field)) continue;
        setError?.(item.field, {
            type: "server",
            message: item.message || errorMessageKey(item.code),
        });
        firstField ??= item.field;
        fieldCount += 1;
    }

    let formErrorCode = null;
    if (fieldCount === 0) {
        formErrorCode = apiError?.code || "UNKNOWN";
        setError?.("root.server", {
            type: formErrorCode,
            message: errorMessageKey(formErrorCode),
        });
    }

    if (firstField) setFocus?.(firstField);
    return { fieldCount, formErrorCode };
}

/** Drops keys the API must not receive (confirm fields, UI-only flags). */
export function omitKeys(values, keys) {
    const copy = { ...values };
    for (const key of keys) delete copy[key];
    return copy;
}
