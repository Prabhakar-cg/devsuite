/**
 * DevSuite API Tester — cookie jar logic (SPEC §4.7.5)
 *
 * Pure module: no DOM access, no internal state. The jar itself is a plain
 * array owned by the caller (api-tester.js keeps it in memory only — cookies
 * are never persisted to DevDB, localStorage, or disk).
 *
 * Loaded in the browser as globalThis.CookieJar; require()-able in node for
 * the unit suite in tests/javascript/.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; }
    else { root.CookieJar = api; }
})(globalThis, function () {
    'use strict';

    /** Default cookie path per RFC 6265 §5.1.4 — request path up to the last slash. */
    function defaultPath(reqPath) {
        if (!reqPath || !reqPath.startsWith('/')) return '/';
        const i = reqPath.lastIndexOf('/');
        return i > 0 ? reqPath.slice(0, i) : '/';
    }

    /** RFC 6265 §5.1.3 domain matching. Host-only cookies require an exact match. */
    function domainMatch(host, cookieDomain, hostOnly) {
        if (hostOnly) return host === cookieDomain;
        return host === cookieDomain || host.endsWith('.' + cookieDomain);
    }

    /** RFC 6265 §5.1.4 path matching. */
    function pathMatch(reqPath, cookiePath) {
        if (reqPath === cookiePath) return true;
        if (reqPath.startsWith(cookiePath)) {
            return cookiePath.endsWith('/') || reqPath[cookiePath.length] === '/';
        }
        return false;
    }

    function isExpired(cookie, nowMs) {
        return cookie.expires !== null && cookie.expires <= (nowMs ?? Date.now());
    }

    /**
     * Parse one Set-Cookie header received from requestUrl.
     * Returns {name, value, domain, hostOnly, path, expires, secure} or null.
     * expires is epoch ms, or null for a session cookie. Max-Age wins over
     * Expires regardless of attribute order (RFC 6265 §4.1.2.2).
     */
    function parse(setCookieStr, requestUrl) {
        if (!setCookieStr || typeof setCookieStr !== 'string') return null;
        let reqHost, reqPath;
        try {
            const u = new URL(requestUrl);
            reqHost = u.hostname.toLowerCase();
            reqPath = u.pathname || '/';
        } catch {
            return null;
        }

        const parts = setCookieStr.split(';');
        const eqIdx = parts[0].indexOf('=');
        if (eqIdx <= 0) return null;
        const cookie = {
            name: parts[0].slice(0, eqIdx).trim(),
            value: parts[0].slice(eqIdx + 1).trim(),
            domain: reqHost,
            hostOnly: true,
            path: defaultPath(reqPath),
            expires: null,
            secure: false,
        };
        if (!cookie.name) return null;

        let maxAgeSeen = false;
        for (const part of parts.slice(1)) {
            const ai = part.indexOf('=');
            const attr = (ai >= 0 ? part.slice(0, ai) : part).trim().toLowerCase();
            const val = ai >= 0 ? part.slice(ai + 1).trim() : '';
            if (attr === 'domain' && val) {
                const dom = val.replace(/^\./, '').toLowerCase();
                // A server may only widen scope to a suffix of its own host (RFC 6265 §5.3.6)
                if (dom && domainMatch(reqHost, dom, false)) {
                    cookie.domain = dom;
                    cookie.hostOnly = false;
                }
            } else if (attr === 'path' && val.startsWith('/')) {
                cookie.path = val;
            } else if (attr === 'expires' && !maxAgeSeen) {
                const t = Date.parse(val);
                if (!Number.isNaN(t)) cookie.expires = t;
            } else if (attr === 'max-age') {
                const secs = parseInt(val, 10);
                if (!Number.isNaN(secs)) {
                    cookie.expires = Date.now() + secs * 1000;
                    maxAgeSeen = true;
                }
            } else if (attr === 'secure') {
                cookie.secure = true;
            }
        }
        return cookie;
    }

    /**
     * Insert or replace in place (same name+domain+path replaces). An already-
     * expired cookie is a server-initiated deletion (Max-Age=0 / past Expires).
     */
    function upsert(jar, cookie) {
        if (!cookie) return jar;
        const idx = jar.findIndex(c =>
            c.name === cookie.name && c.domain === cookie.domain && c.path === cookie.path);
        if (isExpired(cookie)) {
            if (idx >= 0) jar.splice(idx, 1);
            return jar;
        }
        if (idx >= 0) { jar[idx] = cookie; } else { jar.push(cookie); }
        return jar;
    }

    /** All unexpired cookies matching the URL, most-specific path first. */
    function cookiesFor(jar, url, nowMs) {
        let host, path, isHttps;
        try {
            const u = new URL(url);
            host = u.hostname.toLowerCase();
            path = u.pathname || '/';
            isHttps = u.protocol === 'https:';
        } catch {
            return [];
        }
        return jar
            .filter(c => !isExpired(c, nowMs)
                && domainMatch(host, c.domain, c.hostOnly)
                && pathMatch(path, c.path)
                && (!c.secure || isHttps))
            .sort((a, b) => b.path.length - a.path.length);
    }

    /** Cookie header value for the URL; '' when nothing matches. */
    function headerFor(jar, url, nowMs) {
        return cookiesFor(jar, url, nowMs).map(c => `${c.name}=${c.value}`).join('; ');
    }

    /** Drop expired cookies in place. */
    function prune(jar, nowMs) {
        for (let i = jar.length - 1; i >= 0; i--) {
            if (isExpired(jar[i], nowMs)) jar.splice(i, 1);
        }
        return jar;
    }

    return { parse, upsert, cookiesFor, headerFor, prune, domainMatch, pathMatch, isExpired };
});
