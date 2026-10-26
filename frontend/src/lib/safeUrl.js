const ALLOWED_PROTOCOLS = new Set(["https:", "mailto:", "tel:"]);

/**
 * Validates a server-supplied URL before it reaches an href (FE-103): only https, mailto and tel pass.
 * Returns the normalised string, or null when the value must not be rendered as a link.
 */
export function safeExternalUrl(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 2048) return null;
    let url;
    try {
        url = new URL(trimmed);
    } catch {
        return null;
    }
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null;
    if (url.protocol === "https:" && (url.username || url.password))
        return null;
    return url.href;
}
