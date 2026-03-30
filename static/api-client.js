/**
 * DevSuite API Client Wrapper (TypeScript Version)
 *
 * This file serves as the TypeScript source for the fetch wrapper.
 * The functional vanilla JavaScript version is available in api-client.js
 */
export class ApiClient {
    /**
     * UTF-8 safe Base64 encoder
     */
    static encodeBase64Utf8(str) {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(str);
        let binaryString = '';
        for (let i = 0; i < bytes.length; i++) {
            binaryString += String.fromCharCode(bytes[i]);
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
    /**
     * Executes the API Request
     */
    static async execute(config, isRetry = false) {
        const startTime = performance.now();
        let targetUrl = this.buildUrl(config.url, config.queryParams);
        const headers = this.buildHeaders(config);
        const body = this.buildBody(config);
        let fetchUrl = targetUrl;
        let fetchOptions = {
            method: config.method,
            headers: headers,
            body: body
        };
        // If local cors proxy is required (feature for DevSuite)
        if (config.useProxy || isRetry) {
            const proxyTargetHeaders = {};
            headers.forEach((v, k) => { proxyTargetHeaders[k] = v; });
            let finalBodyText = null;
            if (body instanceof URLSearchParams) {
                finalBodyText = body.toString();
            }
            else if (body !== null) {
                finalBodyText = body.toString();
            }
            fetchUrl = '/api/proxy';
            fetchOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: targetUrl,
                    method: config.method,
                    headers: proxyTargetHeaders,
                    body: finalBodyText
                })
            };
        }
        try {
            const response = await fetch(fetchUrl, fetchOptions);
            const arrayBuffer = await response.arrayBuffer();
            const timeMs = Math.round(performance.now() - startTime);
            const sizeBytes = arrayBuffer.byteLength;
            const textDecoder = new TextDecoder('utf-8');
            const bodyText = textDecoder.decode(arrayBuffer);
            let responseJson = null;
            try {
                responseJson = JSON.parse(bodyText);
            }
            catch (e) {
                // Not JSON
            }
            const responseHeaders = {};
            response.headers.forEach((v, k) => {
                responseHeaders[k] = v;
            });
            // If proxy was used, we decode what the proxy sent us
            if ((config.useProxy || isRetry) && response.ok && responseHeaders['content-type'] === 'application/json') {
                try {
                    const proxyWrapper = JSON.parse(bodyText);
                    if (proxyWrapper.proxy_response) {
                        return {
                            status: proxyWrapper.status,
                            statusText: 'Proxy Forwarded',
                            headers: proxyWrapper.headers || {},
                            bodyText: proxyWrapper.body || '',
                            body: (() => { try {
                                return JSON.parse(proxyWrapper.body);
                            }
                            catch {
                                return null;
                            } })(),
                            timeMs: timeMs,
                            sizeBytes: proxyWrapper.body ? new TextEncoder().encode(proxyWrapper.body).length : 0,
                            wasProxied: true
                        };
                    }
                }
                catch (e) { }
            }
            return {
                status: response.status,
                statusText: response.statusText,
                headers: responseHeaders,
                body: responseJson,
                bodyText: bodyText,
                timeMs: timeMs,
                sizeBytes: sizeBytes,
                wasProxied: isRetry || config.useProxy
            };
        }
        catch (error) {
            // Retry with proxy on network/CORS failure if not already tried
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
                wasProxied: isRetry || config.useProxy
            };
        }
    }
}