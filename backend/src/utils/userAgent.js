const BROWSERS = [
    [/edg(?:e|a|ios)?\/(\d+)/i, "Edge"],
    [/opr\/(\d+)|opera/i, "Opera"],
    [/firefox\/(\d+)|fxios\/(\d+)/i, "Firefox"],
    [/chrome\/(\d+)|crios\/(\d+)/i, "Chrome"],
    [/version\/(\d+).*safari/i, "Safari"],
    [/curl\//i, "curl"],
    [/postman|newman/i, "Postman"],
];
const SYSTEMS = [
    [/windows/i, "Windows"],
    [/android/i, "Android"],
    [/iphone|ipad|ios/i, "iOS"],
    [/mac os x|macintosh/i, "macOS"],
    [/linux|x11/i, "Linux"],
];

const firstMatch = (table, text) =>
    table.find(([pattern]) => pattern.test(text))?.[1];

/** Short human label such as "Chrome on Windows" for the sessions list and the new-device mail (never the raw header). */
export function summarizeUserAgent(userAgent) {
    const text = String(userAgent ?? "").slice(0, 200);
    const browser = firstMatch(BROWSERS, text);
    const system = firstMatch(SYSTEMS, text);
    if (browser && system) return `${browser} on ${system}`;
    return browser ?? system ?? "Unknown device";
}
