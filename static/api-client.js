/**
 * DevSuite API Client Wrapper (TypeScript Version)
 *
 * This file serves as the TypeScript source for the fetch wrapper.
 * The functional vanilla JavaScript version is available in api-client.js
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
     * Serialises a fetch body to a plain string for proxy forwarding.
     */
    static _bodyToString(body) {
        if (body === null) return null;
        return body.toString();
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
                statusText: 'Proxy Forwarded',
                headers: proxyWrapper.headers || {},
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
     * Executes the API Request
     */
    static async execute(config, isRetry = false) {
        const startTime = performance.now();
        const targetUrl = this.buildUrl(config.url, config.queryParams);
        const headers = this.buildHeaders(config);
        const body = this.buildBody(config);
        const isProxied = config.useProxy || isRetry;

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
            if (!isRetry && !config.useProxy) {
                console.warn("Direct fetch failed (likely CORS). Retrying automatically via local proxy bypass...");
                return await this.execute(config, true);
            }
            const timeMs = Math.round(performance.now() - startTime);
            return {
                status: 0,
                statusText: 'Network Error',
                headers: {},
                body: null,
                bodyText: error.message + '\n\n(A status of 0 often means a CORS error blocks this request, and DevSuite auto-bypass also failed.)',
                timeMs: timeMs,
                sizeBytes: 0,
                error: error.message,
                wasProxied: isProxied
            };
        }
    }
}

globalThis.ApiClient = ApiClient;