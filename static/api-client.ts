/**
 * DevSuite API Client Wrapper (TypeScript Version)
 * 
 * This file serves as the TypeScript source for the fetch wrapper.
 * The functional vanilla JavaScript version is available in api-client.js
 */

export interface RequestConfig {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    url: string;
    headers?: Record<string, string>;
    queryParams?: Record<string, string>;
    bodyType?: 'none' | 'json' | 'form-data';
    body?: any;
    auth?: {
        type: 'none' | 'bearer' | 'basic';
        token?: string;
        username?: string;
        password?: string;
    };
    useProxy?: boolean;
}

export interface ResponseData {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: any;
    bodyText: string;
    timeMs: number;
    sizeBytes: number;
    error?: string;
    wasProxied?: boolean;
}

export class ApiClient {
    /**
     * UTF-8 safe Base64 encoder
     */
    private static encodeBase64Utf8(str: string): string {
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
    static buildUrl(baseUrl: string, params?: Record<string, string>): string {
        if (!params || Object.keys(params).length === 0) return baseUrl;
        const url = new URL(baseUrl);
        for (const [key, value] of Object.entries(params)) {
             if (key) url.searchParams.append(key, value);
        }
        return url.toString();
    }

    /**
     * Constructs the Headers object and applies Auth
     */
    static buildHeaders(config: RequestConfig): Headers {
        const headers = new Headers();
        
        // Add custom headers
        if (config.headers) {
            for (const [key, value] of Object.entries(config.headers)) {
                if (key) headers.append(key, value);
            }
        }

        // Apply Authentication
        if (config.auth) {
            if (config.auth.type === 'bearer' && config.auth.token) {
                headers.set('Authorization', `Bearer ${config.auth.token}`);
            } else if (config.auth.type === 'basic' && config.auth.username) {
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
    static buildBody(config: RequestConfig): BodyInit | null {
        if (!config.body || config.method === 'GET' || config.method === 'DELETE' || config.bodyType === 'none') {
            return null;
        }

        if (config.bodyType === 'json') {
            return typeof config.body === 'string' ? config.body : JSON.stringify(config.body);
        } else if (config.bodyType === 'form-data') {
            const formData = new URLSearchParams(); // Using URLSearchParams for form-urlencoded
            for (const [key, value] of Object.entries(config.body)) {
                formData.append(key, value as string);
            }
            return formData;
        }

        return config.body;
    }

    /**
     * Serialises a fetch BodyInit to a plain string for proxy forwarding.
     * Both URLSearchParams and other body types serialise via .toString().
     */
    private static _bodyToString(body: BodyInit | null): string | null {
        if (body === null) return null;
        return body.toString();
    }

    /**
     * Tries to decode a proxy-wrapper response payload.
     * Returns a ResponseData object when the payload is proxy-wrapped, otherwise null.
     */
    private static _decodeProxyResponse(bodyText: string, timeMs: number): ResponseData | null {
        try {
            const proxyWrapper = JSON.parse(bodyText);
            if (!proxyWrapper.proxy_response) return null;
            let proxyBody: any = null;
            try { proxyBody = JSON.parse(proxyWrapper.body); } catch (e) {
                // Proxy body is not JSON — leave as null
                console.debug('Proxy body is not JSON:', (e as Error).message);
            }
            return {
                status: proxyWrapper.status,
                statusText: 'Proxy Forwarded',
                headers: proxyWrapper.headers || {},
                bodyText: proxyWrapper.body || '',
                body: proxyBody,
                timeMs,
                sizeBytes: proxyWrapper.body ? new TextEncoder().encode(proxyWrapper.body).length : 0,
                wasProxied: true
            };
        } catch {
            return null;
        }
    }

    /**
     * Builds the fetch URL and RequestInit for routing through the local CORS proxy.
     */
    private static _buildProxyOptions(
        targetUrl: string,
        config: RequestConfig,
        body: BodyInit | null,
        headers: Headers
    ): { fetchUrl: string; fetchOptions: RequestInit } {
        const proxyTargetHeaders: Record<string, string> = {};
        headers.forEach((v, k) => { proxyTargetHeaders[k] = v; });
        return {
            fetchUrl: '/api/proxy',
            fetchOptions: {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
     * Parses a raw fetch Response into a ResponseData-shaped object.
     * When isProxied is true, attempts to unwrap the proxy envelope first.
     */
    private static async _parseResponse(
        response: Response,
        startTime: number,
        isProxied: boolean
    ): Promise<ResponseData> {
        const arrayBuffer = await response.arrayBuffer();
        const timeMs = Math.round(performance.now() - startTime);
        const sizeBytes = arrayBuffer.byteLength;
        const bodyText = new TextDecoder('utf-8').decode(arrayBuffer);

        let responseJson: any = null;
        try {
            responseJson = JSON.parse(bodyText);
        } catch (e) {
            // Response body is not JSON — leave responseJson as null
            console.debug('Response is not JSON:', (e as Error).message);
        }

        const responseHeaders: Record<string, string> = {};
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
            bodyText,
            timeMs,
            sizeBytes,
            wasProxied: isProxied
        };
    }

    /**
     * Executes the API Request
     */
    static async execute(config: RequestConfig, isRetry: boolean = false): Promise<ResponseData> {
        const startTime = performance.now();
        const targetUrl = this.buildUrl(config.url, config.queryParams);
        const headers = this.buildHeaders(config);
        const body = this.buildBody(config);
        const isProxied = config.useProxy || isRetry;

        let fetchUrl: string = targetUrl;
        let fetchOptions: RequestInit = { method: config.method, headers, body };

        if (isProxied) {
            const proxy = this._buildProxyOptions(targetUrl, config, body, headers);
            fetchUrl = proxy.fetchUrl;
            fetchOptions = proxy.fetchOptions;
        }

        try {
            const response = await fetch(fetchUrl, fetchOptions);
            return await this._parseResponse(response, startTime, isProxied);
        } catch (error: any) {
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
                timeMs,
                sizeBytes: 0,
                error: error.message,
                wasProxied: isProxied
            };
        }
    }
}