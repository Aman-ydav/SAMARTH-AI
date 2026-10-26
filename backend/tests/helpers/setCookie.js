/**
 * Parses one `Set-Cookie` line into `{ name, value, httpOnly, secure, sameSite, path, domain, maxAge, expires }`
 * so tests assert flags exactly as a browser would read them (TEST-10).
 */
export function parseSetCookie(line) {
    const [pair, ...attributes] = line.split(";").map((part) => part.trim());
    const separator = pair.indexOf("=");
    const cookie = {
        name: pair.slice(0, separator),
        value: decodeURIComponent(pair.slice(separator + 1)),
        httpOnly: false,
        secure: false,
    };
    for (const attribute of attributes) {
        const [rawKey, ...rest] = attribute.split("=");
        const key = rawKey.toLowerCase();
        const value = rest.join("=");
        if (key === "httponly") cookie.httpOnly = true;
        else if (key === "secure") cookie.secure = true;
        else if (key === "samesite") cookie.sameSite = value.toLowerCase();
        else if (key === "path") cookie.path = value;
        else if (key === "domain") cookie.domain = value;
        else if (key === "max-age") cookie.maxAge = Number(value);
        else if (key === "expires") cookie.expires = new Date(value);
    }
    return cookie;
}

/** All cookies a response sets, keyed by name (the last Set-Cookie for a name wins). */
export function cookiesOf(response) {
    const lines = [response.headers["set-cookie"] ?? []].flat();
    return Object.fromEntries(
        lines
            .map((line) => parseSetCookie(line))
            .map((cookie) => [cookie.name, cookie])
    );
}
