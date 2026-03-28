/**
 * DevSuite API Client Wrapper
 * 
 * Core fetch wrapper handling method construction, headers, auth (Basic/Bearer),
 * query parameters, and measuring response time.
 * 
 * Built to be drop-in 'plug-and-play' for DevSuite.
 */

window.ApiClient = class ApiClient {
    /**
     * Appends query parameters to a URL
     * @param {string} baseUrl
     * @param {Object} params
     * @returns {string}
     */
    static buildUrl(baseUrl, params) {
        if (!params || Object.keys(params).length === 0) return baseUrl;
        try {
            const url = new URL(baseUrl);
            for (const [key, value] of Object.entries(params)) {
                if (key) url.searchParams.append(key, value);
            }
            return url.toString();
        } catch (e) {
            // In case of invalid baseUrl
            return baseUrl;
        }
    }

    /**
     * Constructs the Headers object and applies Auth
     * @param {Object} config
     * @returns {Headers}
     */
    static buildHeaders(config) {
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
                const credentials = btoa(`${config.auth.username}:${config.auth.password || ''}`);
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
     * @param {Object} config
     * @returns {BodyInit|null}
     */
    static buildBody(config) {
        if (!config.body || config.method === 'GET' || config.method === 'DELETE' || config.bodyType === 'none') {
            return null;
        }

        if (config.bodyType === 'json') {
            return typeof config.body === 'string' ? config.body : JSON.stringify(config.body);
        } else if (config.bodyType === 'form-data') {
            const formData = new URLSearchParams(); 
            for (const [key, value] of Object.entries(config.body)) {
                formData.append(key, value);
            }
            return formData;
        }

        return config.body;
    }

    /**
     * Executes the API Request
     * @param {Object} config
     * @returns {Promise<Object>} ResponseData
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

        if (config.useProxy || isRetry) {
            fetchUrl = '/api/proxy';
            const headerObj = {};
            headers.forEach((v, k) => { headerObj[k] = v; });
            
            let finalBodyText = null;
            if (body instanceof URLSearchParams) {
                finalBodyText = body.toString();
                headerObj['Content-Type'] = 'application/x-www-form-urlencoded';
            } else if (body !== null && typeof body === 'object') {
                finalBodyText = JSON.stringify(body);
            } else if (body !== null) {
                finalBodyText = body.toString();
            }

            fetchOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: targetUrl,
                    method: config.method,
                    headers: headerObj,
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
            } catch (e) {
                // Not JSON
            }
            
            if ((config.useProxy || isRetry) && responseJson && responseJson.proxy_response) {
                let actualBodyJson = null;
                try { actualBodyJson = JSON.parse(responseJson.body); } catch(e) {}
                
                return {
                    status: responseJson.status,
                    statusText: responseJson.status >= 200 && responseJson.status < 300 ? 'OK' : 'Error',
                    headers: responseJson.headers || {},
                    body: actualBodyJson,
                    bodyText: responseJson.body || '',
                    timeMs: timeMs,
                    sizeBytes: responseJson.body ? new TextEncoder().encode(responseJson.body).length : 0,
                    wasProxied: isRetry || config.useProxy
                };
            }
            
            const responseHeaders = {};
            response.headers.forEach((v, k) => {
                responseHeaders[k] = v;
            });
            
            return {
                status: response.status,
                statusText: response.statusText,
                headers: responseHeaders,
                body: responseJson,
                bodyText: bodyText,
                timeMs: timeMs,
                sizeBytes: sizeBytes,
                wasProxied: false
            };
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
                wasProxied: isRetry || config.useProxy
            };
        }
    }
};
