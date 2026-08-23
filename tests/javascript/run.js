#!/usr/bin/env node
/**
 * DevSuite JavaScript unit-test runner (SPEC §10.1) — zero dependencies.
 *
 * Covers the pure modules in static/ (curl-codegen.js, cookie-jar.js,
 * collection-utils.js, toon.js, notes-links.js, roadmap-utils.js), which use a
 * browser/node dual export.
 * Run with:  node tests/javascript/run.js
 */
'use strict';

const path = require('path');

const TEST_FILES = [
    'test_curl_codegen.js',
    'test_cookie_jar.js',
    'test_collection_utils.js',
    'test_toon.js',
    'test_notes_links.js',
    'test_notes_preview.js',
    'test_roadmap_utils.js',
];

let passed = 0;
let failed = 0;

global.test = (name, fn) => {
    try {
        fn();
        passed++;
        console.log(`  ✓ ${name}`);
    } catch (e) {
        failed++;
        console.error(`  ✗ ${name}`);
        console.error(`    ${(e && e.message) || e}`);
    }
};

for (const file of TEST_FILES) {
    console.log(`\n${file}`);
    require(path.join(__dirname, file));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
