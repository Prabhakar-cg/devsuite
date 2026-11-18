/** Unit tests for static/json-schema-lite.js — JSON Schema validator (BACKLOG AI-4). */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validate, checkSchema } = require('../../static/json-schema-lite.js');

const ok = (data, schema) => assert.deepEqual(validate(data, schema).errors, [], JSON.stringify(data));
const bad = (data, schema, keyword) => {
    const r = validate(data, schema);
    assert.equal(r.valid, false, 'expected invalid: ' + JSON.stringify(data));
    if (keyword) assert.ok(r.errors.some((e) => e.keyword === keyword), keyword + ' in ' + JSON.stringify(r.errors));
    return r;
};

test('type: scalars, integer vs number, arrays of types, null', () => {
    ok('x', { type: 'string' }); bad(1, { type: 'string' }, 'type');
    ok(3, { type: 'integer' }); bad(3.5, { type: 'integer' }, 'type'); ok(3, { type: 'number' }); ok(3.5, { type: 'number' });
    ok(null, { type: ['string', 'null'] }); bad(true, { type: ['string', 'null'] }, 'type');
    ok([], { type: 'array' }); ok({}, { type: 'object' }); bad([], { type: 'object' }, 'type');
});

test('enum and const use deep equality', () => {
    ok({ a: [1, 2] }, { enum: [{ a: [1, 2] }, 5] }); bad({ a: [2, 1] }, { enum: [{ a: [1, 2] }] }, 'enum');
    ok('x', { const: 'x' }); bad('y', { const: 'x' }, 'const');
});

test('strings: length (by code point), pattern, format', () => {
    bad('a', { minLength: 2 }, 'minLength'); bad('abc', { maxLength: 2 }, 'maxLength'); ok('\u{1F600}\u{1F600}', { maxLength: 2 });
    ok('abc123', { pattern: '^[a-z]+\\d+$' }); bad('ABC', { pattern: '^[a-z]+$' }, 'pattern');
    ok('a@b.co', { format: 'email' }); bad('nope', { format: 'email' }, 'format');
    ok('550e8400-e29b-41d4-a716-446655440000', { format: 'uuid' }); bad('550e8400', { format: 'uuid' }, 'format');
    ok('2026-11-17', { format: 'date' }); bad('2026-13-45', { format: 'date' }, 'format');
    ok('2026-11-17T10:00:00Z', { format: 'date-time' }); ok('10.0.0.255', { format: 'ipv4' }); bad('10.0.0.256', { format: 'ipv4' }, 'format');
    ok('anything', { format: 'unknown-format' });
});

test('numbers: bounds, exclusive bounds, multipleOf (float-safe)', () => {
    bad(0, { minimum: 1 }, 'minimum'); bad(11, { maximum: 10 }, 'maximum'); ok(10, { maximum: 10 });
    bad(1, { exclusiveMinimum: 1 }, 'exclusiveMinimum'); bad(10, { exclusiveMaximum: 10 }, 'exclusiveMaximum');
    ok(0.3, { multipleOf: 0.1 }); bad(7, { multipleOf: 2 }, 'multipleOf');
});

test('objects: required, additionalProperties false/schema, patternProperties, property counts, propertyNames', () => {
    const s = { type: 'object', required: ['name'], properties: { name: { type: 'string' }, age: { type: 'integer' } }, additionalProperties: false };
    ok({ name: 'a', age: 3 }, s);
    bad({}, s, 'required'); bad({ name: 'a', extra: 1 }, s, 'additionalProperties');
    const r = bad({ name: 5 }, s, 'type'); assert.equal(r.errors[0].path, '/name');
    ok({ a: 'x', b: 2 }, { additionalProperties: { type: ['string', 'number'] } }); bad({ a: [] }, { additionalProperties: { type: 'string' } }, 'type');
    ok({ x_1: 1 }, { patternProperties: { '^x_': { type: 'integer' } }, additionalProperties: false }); bad({ x_1: 'a' }, { patternProperties: { '^x_': { type: 'integer' } } }, 'type');
    bad({ a: 1 }, { minProperties: 2 }, 'minProperties'); bad({ a: 1, b: 2 }, { maxProperties: 1 }, 'maxProperties');
    bad({ Bad: 1 }, { propertyNames: { pattern: '^[a-z]+$' } }, 'pattern');
    bad({ credit_card: 1 }, { dependentRequired: { credit_card: ['billing'] } }, 'dependentRequired');
});

test('arrays: items, tuples, bounds, uniqueItems, contains/minContains/maxContains', () => {
    ok([1, 2], { items: { type: 'integer' } }); const r = bad([1, 'x'], { items: { type: 'integer' } }, 'type'); assert.equal(r.errors[0].path, '/1');
    ok([1, 'a'], { prefixItems: [{ type: 'integer' }, { type: 'string' }], items: false }); bad([1, 'a', 3], { prefixItems: [{ type: 'integer' }, { type: 'string' }], items: false }, 'false');
    ok([1, 'a'], { items: [{ type: 'integer' }, { type: 'string' }] });
    bad([], { minItems: 1 }, 'minItems'); bad([1, 2], { maxItems: 1 }, 'maxItems');
    bad([1, 2, 1], { uniqueItems: true }, 'uniqueItems'); ok([{ a: 1 }, { a: 2 }], { uniqueItems: true });
    ok([1, 'x'], { contains: { type: 'string' } }); bad([1, 2], { contains: { type: 'string' } }, 'contains');
    bad(['a', 'b', 'c'], { contains: { type: 'string' }, maxContains: 2 }, 'maxContains'); bad(['a'], { contains: { type: 'string' }, minContains: 2 }, 'contains');
});

test('composition: allOf, anyOf, oneOf, not', () => {
    ok(5, { allOf: [{ type: 'integer' }, { minimum: 3 }] }); bad(2, { allOf: [{ type: 'integer' }, { minimum: 3 }] }, 'minimum');
    ok('a', { anyOf: [{ type: 'string' }, { type: 'integer' }] }); bad(true, { anyOf: [{ type: 'string' }, { type: 'integer' }] }, 'anyOf');
    ok(3, { oneOf: [{ type: 'integer' }, { type: 'string' }] }); bad(3, { oneOf: [{ type: 'integer' }, { minimum: 0 }] }, 'oneOf'); bad(true, { oneOf: [{ type: 'integer' }] }, 'oneOf');
    ok('x', { not: { type: 'integer' } }); bad(1, { not: { type: 'integer' } }, 'not');
});

test('anyOf/oneOf/not/if do not leak the errors of their failed branches', () => {
    assert.deepEqual(validate('a', { anyOf: [{ type: 'integer' }, { type: 'string' }] }).errors, []);
    assert.deepEqual(validate(3, { not: { type: 'string' } }).errors, []);
    const r = validate(3, { if: { type: 'string' }, then: { minLength: 5 }, else: { minimum: 1 } });
    assert.deepEqual(r.errors, []);
});

test('if/then/else routes by the condition', () => {
    const s = { if: { properties: { kind: { const: 'a' } }, required: ['kind'] }, then: { required: ['x'] }, else: { required: ['y'] } };
    ok({ kind: 'a', x: 1 }, s); bad({ kind: 'a' }, s, 'required'); ok({ kind: 'b', y: 1 }, s); bad({ kind: 'b' }, s, 'required');
});

test('$ref: local definitions, $defs, recursion, and unresolvable refs', () => {
    const s = { definitions: { pos: { type: 'integer', minimum: 1 } }, properties: { n: { $ref: '#/definitions/pos' } } };
    ok({ n: 2 }, s); bad({ n: 0 }, s, 'minimum');
    const tree = { $defs: { node: { type: 'object', properties: { kids: { type: 'array', items: { $ref: '#/$defs/node' } } } } }, $ref: '#/$defs/node' };
    ok({ kids: [{ kids: [] }] }, tree); bad({ kids: [{ kids: 3 }] }, tree, 'type');
    bad(1, { $ref: '#/nope' }, '$ref'); bad(1, { $ref: 'http://x/y' }, '$ref');
    bad(1, { $ref: '#' }, '$ref'); // infinite self-reference is caught by the depth guard, not a hang
});

test('boolean schemas', () => {
    ok(1, true); bad(1, false, 'false'); ok({ a: 1 }, { properties: { a: true } }); bad({ a: 1 }, { properties: { a: false } }, 'false');
});

test('errors carry JSON-pointer paths (with escaping) and schema paths', () => {
    const r = validate({ 'a/b': { 'c~d': 'x' } }, { properties: { 'a/b': { properties: { 'c~d': { type: 'integer' } } } } });
    assert.equal(r.errors[0].path, '/a~1b/c~0d');
    assert.match(r.errors[0].schemaPath, /^#\/properties/);
});

test('unsupported keywords are reported, not silently passed; x- extensions are ignored quietly', () => {
    const r = validate(1, { type: 'integer', unevaluatedProperties: false, 'x-internal': true });
    assert.deepEqual(r.ignored, ['unevaluatedProperties']);
});

test('maxErrors caps the report', () => {
    const r = validate(new Array(500).fill('x'), { items: { type: 'integer' } }, { maxErrors: 10 });
    assert.equal(r.errors.length, 10);
});

test('realistic LLM function-call arguments schema', () => {
    const schema = {
        type: 'object', required: ['city', 'unit'], additionalProperties: false,
        properties: { city: { type: 'string', minLength: 1 }, unit: { enum: ['celsius', 'fahrenheit'] }, days: { type: 'integer', minimum: 1, maximum: 14 } },
    };
    ok({ city: 'Oslo', unit: 'celsius', days: 3 }, schema);
    const r = validate({ city: '', unit: 'kelvin', days: 30, extra: true }, schema);
    assert.deepEqual(r.errors.map((e) => e.keyword).sort(), ['additionalProperties', 'enum', 'maximum', 'minLength']);
});

test('invalid regex patterns report an error instead of throwing', () => {
    const r = validate('x', { pattern: '(' });
    assert.equal(r.valid, false);
});

test('checkSchema rejects obviously broken schemas', () => {
    assert.equal(checkSchema({ type: 'object' }), null); assert.equal(checkSchema(true), null);
    assert.match(checkSchema([]), /must be an object/); assert.match(checkSchema({ type: 'strin' }), /unknown value/);
    assert.match(checkSchema({ required: 'name' }), /array/);
});

test('the validator uses no DOM, network, storage or code evaluation', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../static/json-schema-lite.js'), 'utf8');
    for (const badWord of ['document.', 'fetch(', 'XMLHttpRequest', 'localStorage', 'eval(', 'new Function', 'innerHTML']) assert.ok(!src.includes(badWord), badWord);
});
