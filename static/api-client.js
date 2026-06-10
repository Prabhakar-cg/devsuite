/**
 * DevSuite API Client Wrapper
 *
 * Canonical hand-maintained vanilla-JS fetch wrapper for the API Tester.
 * Loaded directly by api-tester.html — no build step or compilation.
 */
class ApiClient {
    /**
     * UTF-8 safe Base64 encoder
     */
    static encodeBase64Utf8(str) {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(str);
        let binaryString = '';
        for (const byte of bytes) {
            binaryString += String.fromCodePoint(byte);
        }
        return btoa(binaryString);
    }
    /**
     * Appends query parameters to a URL
     */
    static buildUrl(baseUrl, params) {
        if (!params || Object.keys(params).length === 0)
            return baseUrl;
        const url = new URL(baseUrl);
        for (const [key, value] of Object.entries(params)) {
            if (key)
                url.searchParams.append(key, value);
        }
        return url.toString();
    }
    /**
     * Constructs the Headers object and applies Auth
     */
    static buildHeaders(config) {
        const headers = new Headers();
        // Add custom headers
        if (config.headers) {
            for (const [key, value] of Object.entries(config.headers)) {
                if (key)
                    headers.append(key, value);
            }
        }
        // Apply Authentication
        if (config.auth) {
            if (config.auth.type === 'bearer' && config.auth.token) {
                headers.set('Authorization', `Bearer ${config.auth.token}`);
            }
            else if (config.auth.type === 'basic' && config.auth.username) {
                const credentials = this.encodeBase64Utf8(`${config.auth.username}:${config.auth.password || ''}`);
                headers.set('Authorization', `Basic ${credentials}`);
            }
        }
        // Apply content type for JSON if not already set
        if (config.bodyType === 'json' && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }
        return headers;
    }
    /**
     * Builds the body payload for fetch
     */
    static buildBody(config) {
        if (!config.body || config.method === 'GET' || config.method === 'DELETE' || config.bodyType === 'none') {
            return null;
        }
        if (config.bodyType === 'json') {
            return typeof config.body === 'string' ? config.body : JSON.stringify(config.body);
        }
        else if (config.bodyType === 'form-data') {
            const formData = new URLSearchParams(); // Using URLSearchParams for form-urlencoded
            for (const [key, value] of Object.entries(config.body)) {
                formData.append(key, value);
            }
            return formData;
        }
        return config.body;
    }
    static _getCsrfToken() {
        const m = /(?:^|;\s*)ds_csrf=([^;]+)/.exec(document.cookie);
        return m ? decodeURIComponent(m[1]) : '';
    }

    /**
     * Returns true when targetUrl resolves to a different origin than the
     * DevSuite page itself.  Same-origin requests never need the proxy.
     */
    static _isCrossOrigin(targetUrl) {
        try {
            return new URL(targetUrl).origin !== window.location.origin;
        } catch {
            return false; // relative URL or unparseable — treat as same-origin
        }
    }

    /**
     * Returns true when this request will definitely trigger a CORS preflight
     * (OPTIONS) that a server without a CORS policy will reject before the
     * actual request even goes out.
     *
     * Based on the Fetch spec "simple request" criteria:
     *   • Method must be GET, HEAD, or POST
     *   • Only CORS-safelisted headers are present
     *   • Content-Type (if set) is one of the three simple values
     *
     * If any condition fails the browser sends a preflight → we skip the
     * direct attempt and route through the proxy immediately.
     */
    static _willNeedPreflight(method, headers) {
        if (!['GET', 'HEAD', 'POST'].includes(method.toUpperCase())) return true;

        const SAFELISTED = new Set([
            'accept', 'accept-language', 'content-language', 'content-type',
        ]);
        for (const [key] of headers.entries()) {
            if (!SAFELISTED.has(key.toLowerCase())) return true;
        }

        const ct = (headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        if (ct && !['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'].includes(ct)) {
            return true;
        }

        return false;
    }

    /**
     * Serialises a fetch body to a plain string for proxy forwarding.
     */
    static _bodyToString(body) {
        if (body === null) return null;
        return body.toString();
    }

    static _httpReasonPhrase(status) {
        const phrases = {
            100: 'Continue',            101: 'Switching Protocols',
            200: 'OK',                  201: 'Created',             202: 'Accepted',
            204: 'No Content',          206: 'Partial Content',
            301: 'Moved Permanently',   302: 'Found',               304: 'Not Modified',
            400: 'Bad Request',         401: 'Unauthorized',        403: 'Forbidden',
            404: 'Not Found',           405: 'Method Not Allowed',  408: 'Request Timeout',
            409: 'Conflict',            410: 'Gone',                422: 'Unprocessable Entity',
            429: 'Too Many Requests',
            500: 'Internal Server Error', 501: 'Not Implemented',   502: 'Bad Gateway',
            503: 'Service Unavailable', 504: 'Gateway Timeout',
        };
        return phrases[status] || 'Unknown';
    }

    /**
     * Tries to decode a proxy wrapper response. Returns the decoded ResponseData
     * object when the response was a proxy-wrapped payload, otherwise null.
     */
    static _decodeProxyResponse(bodyText, timeMs) {
        try {
            const proxyWrapper = JSON.parse(bodyText);
            if (!proxyWrapper.proxy_response) return null;
            return {
                status: proxyWrapper.status,
                statusText: this._httpReasonPhrase(proxyWrapper.status),
                headers: proxyWrapper.headers || {},
                setCookies: proxyWrapper.set_cookie || [],
                bodyText: proxyWrapper.body || '',
                body: (() => { try { return JSON.parse(proxyWrapper.body); } catch { return null; } })(),
                timeMs: timeMs,
                sizeBytes: proxyWrapper.body ? new TextEncoder().encode(proxyWrapper.body).length : 0,
                wasProxied: true
            };
        } catch {
            return null;
        }
    }

    /**
     * Parses a raw fetch Response into a ResponseData-shaped object.
     * Handles proxy-wrapped payloads when isProxied is true.
     */
    static async _parseResponse(response, startTime, isProxied) {
        const arrayBuffer = await response.arrayBuffer();
        const timeMs = Math.round(performance.now() - startTime);
        const sizeBytes = arrayBuffer.byteLength;
        const bodyText = new TextDecoder('utf-8').decode(arrayBuffer);

        let responseJson = null;
        try {
            responseJson = JSON.parse(bodyText);
        } catch (e) {
            // Response body is not JSON — leave responseJson as null
            console.debug('Response is not JSON:', e.message);
        }

        const responseHeaders = {};
        response.headers.forEach((v, k) => { responseHeaders[k] = v; });

        if (isProxied && response.ok && responseHeaders['content-type'] === 'application/json') {
            const decoded = this._decodeProxyResponse(bodyText, timeMs);
            if (decoded) return decoded;
        }

        return {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            // Direct responses: Set-Cookie is managed by the browser and not
            // exposed to fetch; only proxied responses feed the cookie jar.
            setCookies: [],
            body: responseJson,
            bodyText: bodyText,
            timeMs: timeMs,
            sizeBytes: sizeBytes,
            wasProxied: isProxied
        };
    }

    /**
     * Builds the fetch URL and options for a proxy request.
     */
    static _buildProxyOptions(targetUrl, config, body, headers) {
        const proxyTargetHeaders = {};
        headers.forEach((v, k) => { proxyTargetHeaders[k] = v; });
        const csrfToken = this._getCsrfToken();
        const fetchHeaders = { 'Content-Type': 'application/json' };
        if (csrfToken) fetchHeaders['X-CSRF-Token'] = csrfToken;
        return {
            fetchUrl: '/api/proxy',
            fetchOptions: {
                method: 'POST',
                headers: fetchHeaders,
                body: JSON.stringify({
                    url: targetUrl,
                    method: config.method,
                    headers: proxyTargetHeaders,
                    body: this._bodyToString(body)
                })
            }
        };
    }

    /**
     * Executes the API Request.
     *
     * Routing strategy (smart CORS handling):
     *
     *  1. Same-origin target  →  direct fetch only (no CORS involved).
     *
     *  2. Cross-origin + non-simple request (has Authorization header, custom
     *     headers, JSON body, PUT/PATCH/DELETE, …)  →  the browser would send a
     *     CORS preflight (OPTIONS) that almost certainly fails on APIs with no
     *     CORS policy. Skip the doomed direct attempt; route through the local
     *     proxy immediately. This eliminates one failing round-trip, the
     *     "CORS blocked" error in browser DevTools, and the visible latency
     *     spike before the proxy kicks in.
     *
     *  3. Cross-origin + simple request (bare GET/HEAD, POST with form body, no
     *     custom headers)  →  try direct first. If the API returns
     *     Access-Control-Allow-Origin the response succeeds without a proxy.
     *     On any fetch error fall back to the proxy (isRetry path).
     *
     *  4. config.useProxy = true  →  always proxy (user override).
     */
    static async execute(config, isRetry = false) {
        const startTime = performance.now();
        const targetUrl = this.buildUrl(config.url, config.queryParams);
        const headers = this.buildHeaders(config);
        const body = this.buildBody(config);

        // Determine routing before the first network attempt.
        const skipDirect = !config.useProxy
            && !isRetry
            && this._isCrossOrigin(targetUrl)
            && this._willNeedPreflight(config.method, headers);

        const isProxied = config.useProxy || isRetry || skipDirect;

        let fetchUrl = targetUrl;
        let fetchOptions = { method: config.method, headers: headers, body: body };

        if (isProxied) {
            const proxy = this._buildProxyOptions(targetUrl, config, body, headers);
            fetchUrl = proxy.fetchUrl;
            fetchOptions = proxy.fetchOptions;
        }

        try {
            const response = await fetch(fetchUrl, fetchOptions);
            return await this._parseResponse(response, startTime, isProxied);
        } catch (error) {
            if (!isRetry && !isProxied) {
                // Simple cross-origin request tried directly and failed — fall back to proxy.
                console.warn('Direct fetch failed (likely CORS or network). Retrying via local proxy…');
                return await this.execute(config, true);
            }
            // Proxy path also failed — return a structured error response.
            const timeMs = Math.round(performance.now() - startTime);
            return {
                status: 0,
                statusText: 'Network Error',
                headers: {},
                setCookies: [],
                body: null,
                bodyText: error.message
                    + '\n\n(Status 0 — the target host may be unreachable, or the proxy could not connect.)',
                timeMs: timeMs,
                sizeBytes: 0,
                error: error.message,
                wasProxied: isProxied,
            };
        }
    }
}

globalThis.ApiClient = ApiClient;