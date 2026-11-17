/**
 * DevSuite JSON Schema validator ("lite") — BACKLOG AI-4.
 * ---------------------------------------------------------
 * A compact, dependency-free validator for the JSON Schema keywords developers actually use
 * for LLM structured-output / function-calling payloads and config files (draft 2020-12 /
 * draft-07 compatible subset). Pure: no DOM, no network, no eval. Loaded in the browser as
 * globalThis.JsonSchemaLite and require()-able in node for tests/javascript/.
 *
 * Supported: type (incl. arrays of types; "integer"), enum, const, properties, required,
 * additionalProperties (bool|schema), patternProperties, propertyNames, minProperties,
 * maxProperties, dependentRequired, items (schema | tuple array), prefixItems, additionalItems,
 * minItems, maxItems, uniqueItems, contains (+minContains/maxContains), minLength, maxLength,
 * pattern, minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf, allOf, anyOf,
 * oneOf, not, if/then/else, local $ref ("#", "#/definitions/…", "#/$defs/…"), and a small set
 * of `format` assertions (email, uuid, date, date-time, uri, ipv4, hostname).
 * Unsupported keywords are reported in `result.ignored`, never silently treated as passing.
 *
 * Error: { path: "/a/0/b" (JSON Pointer to the data), keyword, message, schemaPath }
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; }
    else { root.JsonSchemaLite = api; }
})(globalThis, function () {
    'use strict';

    const KNOWN = new Set(['$schema', '$id', '$comment', '$defs', 'definitions', '$ref', 'title', 'description', 'default', 'examples',
        'deprecated', 'readOnly', 'writeOnly', 'type', 'enum', 'const', 'properties', 'required', 'additionalProperties',
        'patternProperties', 'propertyNames', 'minProperties', 'maxProperties', 'dependentRequired', 'items', 'prefixItems',
        'additionalItems', 'minItems', 'maxItems', 'uniqueItems', 'contains', 'minContains', 'maxContains', 'minLength',
        'maxLength', 'pattern', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'allOf',
        'anyOf', 'oneOf', 'not', 'if', 'then', 'else', 'format']);

    const FORMATS = {
        email: (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),
        uuid: (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s),
        date: (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)),
        'date-time': (s) => /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/.test(s) && !Number.isNaN(Date.parse(s)),
        uri: (s) => /^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]+$/.test(s),
        ipv4: (s) => /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(s),
        hostname: (s) => /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(s),
    };

    function typeOf(v) {
        if (v === null) return 'null';
        if (Array.isArray(v)) return 'array';
        if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
        return typeof v;   // string | boolean | object
    }
    function isType(v, t) {
        const actual = typeOf(v);
        return actual === t || (t === 'number' && actual === 'integer');
    }
    function deepEqual(a, b) {
        if (a === b) return true;
        if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
        if (Array.isArray(a) !== Array.isArray(b)) return false;
        const ka = Object.keys(a), kb = Object.keys(b);
        return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
    }
    const ptr = (path, seg) => path + '/' + String(seg).replace(/~/g, '~0').replace(/\//g, '~1');
    const fmt = (v) => { const s = JSON.stringify(v); return s && s.length > 40 ? s.slice(0, 37) + '…' : String(s); };

    function resolveRef(ref, rootSchema) {
        if (ref === '#') return rootSchema;
        if (!ref.startsWith('#/')) return undefined;
        let node = rootSchema;
        for (const raw of ref.slice(2).split('/')) {
            const seg = decodeURIComponent(raw).replace(/~1/g, '/').replace(/~0/g, '~');
            if (node === null || typeof node !== 'object' || !Object.hasOwn(node, seg)) return undefined;
            node = node[seg];
        }
        return node;
    }

    function safeRegExp(src) {
        try { return new RegExp(src, 'u'); } catch { try { return new RegExp(src); } catch { return null; } }
    }

    /** Validate `data` against `schema`. Returns { valid, errors, ignored }. */
    function validate(data, schema, options) {
        const opts = Object.assign({ maxErrors: 100, formats: true }, options);
        const errors = [];
        const ignored = new Set();
        let depth = 0;

        const add = (path, keyword, message, schemaPath) => {
            if (errors.length < opts.maxErrors) errors.push({ path: path || '', keyword, message, schemaPath });
        };

        function check(value, sch, path, sp) {
            if (sch === true || sch === undefined) return true;
            if (sch === false) { add(path, 'false', 'no value is allowed here (schema is false)', sp); return false; }
            if (sch === null || typeof sch !== 'object' || Array.isArray(sch)) return true;
            if (++depth > 64) { depth--; add(path, '$ref', 'schema nesting too deep (possible $ref cycle)', sp); return false; }
            let ok = true;
            const fail = (keyword, message) => { ok = false; add(path, keyword, message, sp + '/' + keyword); };

            for (const k of Object.keys(sch)) if (!KNOWN.has(k) && !k.startsWith('x-')) ignored.add(k);

            if (typeof sch.$ref === 'string') {
                const target = resolveRef(sch.$ref, schema);
                if (target === undefined) fail('$ref', 'cannot resolve reference ' + sch.$ref + ' (only local "#/…" refs are supported)');
                else if (!check(value, target, path, sp + '/$ref')) ok = false;
            }
            if (sch.type !== undefined) {
                const types = Array.isArray(sch.type) ? sch.type : [sch.type];
                if (!types.some((t) => isType(value, t))) fail('type', 'expected ' + types.join(' or ') + ', got ' + typeOf(value));
            }
            if (Array.isArray(sch.enum) && !sch.enum.some((e) => deepEqual(e, value))) fail('enum', 'must be one of ' + fmt(sch.enum));
            if (Object.hasOwn(sch, 'const') && !deepEqual(sch.const, value)) fail('const', 'must equal ' + fmt(sch.const));

            if (typeof value === 'string') {
                const len = [...value].length;
                if (sch.minLength !== undefined && len < sch.minLength) fail('minLength', 'must be at least ' + sch.minLength + ' characters (got ' + len + ')');
                if (sch.maxLength !== undefined && len > sch.maxLength) fail('maxLength', 'must be at most ' + sch.maxLength + ' characters (got ' + len + ')');
                if (typeof sch.pattern === 'string') {
                    const re = safeRegExp(sch.pattern);
                    if (!re) fail('pattern', 'invalid pattern ' + fmt(sch.pattern));
                    else if (!re.test(value)) fail('pattern', 'must match pattern ' + sch.pattern);
                }
                if (opts.formats && typeof sch.format === 'string' && FORMATS[sch.format] && !FORMATS[sch.format](value)) fail('format', 'must be a valid ' + sch.format);
            }
            if (typeof value === 'number') {
                if (sch.minimum !== undefined && value < sch.minimum) fail('minimum', 'must be ≥ ' + sch.minimum);
                if (sch.maximum !== undefined && value > sch.maximum) fail('maximum', 'must be ≤ ' + sch.maximum);
                if (typeof sch.exclusiveMinimum === 'number' && value <= sch.exclusiveMinimum) fail('exclusiveMinimum', 'must be > ' + sch.exclusiveMinimum);
                if (typeof sch.exclusiveMaximum === 'number' && value >= sch.exclusiveMaximum) fail('exclusiveMaximum', 'must be < ' + sch.exclusiveMaximum);
                if (sch.multipleOf > 0) {
                    const q = value / sch.multipleOf;
                    if (Math.abs(q - Math.round(q)) > 1e-9) fail('multipleOf', 'must be a multiple of ' + sch.multipleOf);
                }
            }
            if (Array.isArray(value)) {
                if (sch.minItems !== undefined && value.length < sch.minItems) fail('minItems', 'must have at least ' + sch.minItems + ' items (got ' + value.length + ')');
                if (sch.maxItems !== undefined && value.length > sch.maxItems) fail('maxItems', 'must have at most ' + sch.maxItems + ' items (got ' + value.length + ')');
                if (sch.uniqueItems === true) {
                    outer: for (let i = 0; i < value.length; i++) for (let j = i + 1; j < value.length; j++) {
                        if (deepEqual(value[i], value[j])) { fail('uniqueItems', 'items ' + i + ' and ' + j + ' are identical'); break outer; }
                    }
                }
                const tuple = Array.isArray(sch.prefixItems) ? sch.prefixItems : (Array.isArray(sch.items) ? sch.items : null);
                const rest = Array.isArray(sch.prefixItems) ? sch.items : sch.additionalItems;
                value.forEach((item, i) => {
                    let s;
                    if (tuple && i < tuple.length) s = tuple[i];
                    else if (tuple) s = rest;
                    else s = sch.items;
                    if (s !== undefined && !check(item, s, ptr(path, i), sp + '/items')) ok = false;
                });
                if (sch.contains !== undefined) {
                    const scratch = errors.length;
                    const matches = value.filter((item) => check(item, sch.contains, path, sp + '/contains')).length;
                    errors.length = scratch;   // contains failures on individual items are not errors
                    const min = sch.minContains === undefined ? 1 : sch.minContains;
                    if (matches < min) fail('contains', 'must contain at least ' + min + ' matching item(s) (found ' + matches + ')');
                    if (sch.maxContains !== undefined && matches > sch.maxContains) fail('maxContains', 'must contain at most ' + sch.maxContains + ' matching item(s)');
                }
            }
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                const keys = Object.keys(value);
                if (Array.isArray(sch.required)) for (const r of sch.required) if (!Object.hasOwn(value, r)) fail('required', 'missing required property "' + r + '"');
                if (sch.minProperties !== undefined && keys.length < sch.minProperties) fail('minProperties', 'must have at least ' + sch.minProperties + ' properties');
                if (sch.maxProperties !== undefined && keys.length > sch.maxProperties) fail('maxProperties', 'must have at most ' + sch.maxProperties + ' properties');
                if (sch.dependentRequired && typeof sch.dependentRequired === 'object') {
                    for (const [k, deps] of Object.entries(sch.dependentRequired)) {
                        if (Object.hasOwn(value, k)) for (const d of deps) if (!Object.hasOwn(value, d)) fail('dependentRequired', '"' + k + '" requires "' + d + '"');
                    }
                }
                const props = sch.properties || {};
                const patterns = Object.entries(sch.patternProperties || {}).map(([src, s]) => [safeRegExp(src), s]);
                for (const k of keys) {
                    let matched = false;
                    if (Object.hasOwn(props, k)) { matched = true; if (!check(value[k], props[k], ptr(path, k), sp + '/properties/' + k)) ok = false; }
                    for (const [re, s] of patterns) if (re && re.test(k)) { matched = true; if (!check(value[k], s, ptr(path, k), sp + '/patternProperties')) ok = false; }
                    if (!matched && sch.additionalProperties !== undefined) {
                        if (sch.additionalProperties === false) fail('additionalProperties', 'unexpected property "' + k + '"');
                        else if (!check(value[k], sch.additionalProperties, ptr(path, k), sp + '/additionalProperties')) ok = false;
                    }
                    if (sch.propertyNames !== undefined && !check(k, sch.propertyNames, ptr(path, k), sp + '/propertyNames')) ok = false;
                }
            }

            if (Array.isArray(sch.allOf)) sch.allOf.forEach((s, i) => { if (!check(value, s, path, sp + '/allOf/' + i)) ok = false; });
            if (Array.isArray(sch.anyOf)) {
                const scratch = errors.length;
                const any = sch.anyOf.some((s, i) => check(value, s, path, sp + '/anyOf/' + i));
                if (any) errors.length = scratch; else fail('anyOf', 'does not match any of the ' + sch.anyOf.length + ' allowed schemas');
            }
            if (Array.isArray(sch.oneOf)) {
                const scratch = errors.length;
                const n = sch.oneOf.filter((s, i) => check(value, s, path, sp + '/oneOf/' + i)).length;
                errors.length = scratch;
                if (n !== 1) fail('oneOf', n === 0 ? 'does not match any of the ' + sch.oneOf.length + ' allowed schemas' : 'matches ' + n + ' schemas but must match exactly one');
            }
            if (sch.not !== undefined) {
                const scratch = errors.length;
                const matches = check(value, sch.not, path, sp + '/not');
                errors.length = scratch;
                if (matches) fail('not', 'must not match the "not" schema');
            }
            if (sch.if !== undefined) {
                const scratch = errors.length;
                const cond = check(value, sch.if, path, sp + '/if');
                errors.length = scratch;
                const branch = cond ? sch.then : sch.else;
                if (branch !== undefined && !check(value, branch, path, sp + (cond ? '/then' : '/else'))) ok = false;
            }
            depth--;
            return ok;
        }

        const valid = check(data, schema, '', '#');
        return { valid: valid && errors.length === 0, errors, ignored: [...ignored].sort() };
    }

    /** Sanity-check a schema document before use. Returns an error string or null. */
    function checkSchema(schema) {
        if (typeof schema === 'boolean') return null;
        if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) return 'A JSON Schema must be an object (or true/false).';
        if (schema.type !== undefined) {
            const ok = ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null'];
            const types = Array.isArray(schema.type) ? schema.type : [schema.type];
            const bad = types.find((t) => !ok.includes(t));
            if (bad !== undefined) return '"type" has an unknown value: ' + fmt(bad);
        }
        if (schema.required !== undefined && !Array.isArray(schema.required)) return '"required" must be an array of property names.';
        return null;
    }

    return { validate, checkSchema, typeOf, deepEqual, FORMATS };
});
