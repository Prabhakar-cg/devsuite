#!/usr/bin/env node
/**
 * DevSuite JavaScript unit-test runner (SPEC §10.1) — zero dependencies.
 *
 * Covers the pure modules in static/ (curl-codegen.js, cookie-jar.js,
 * collection-utils.js, toon.js, notes-links.js, roadmap-utils.js), which use a
 * browser/node dual export.
 *
 * Test registration (`test(name, fn)`, called at require-time) and execution are
 * separate passes: every file is `require()`d first to collect its tests, then
 * they run afterward in one `await`ed loop, in file order. This lets `fn` be
 * async (e.g. RoadmapUtils.createSerialQueue's ordering guarantees, which need
 * real Promise settling to assert anything) without a test's rejection racing
 * past its `try`/`catch` the way a bare synchronous `fn()` call would.
 *
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

const tests = [];
let currentFile = null;

global.test = (name, fn) => {
    tests.push({ file: currentFile, name, fn });
};

for (const file of TEST_FILES) {
    currentFile = file;
    require(path.join(__dirname, file));
}

async function runAll() {
    let passed = 0;
    let failed = 0;
    let printedFile = null;

    for (const { file, name, fn } of tests) {
        if (file !== printedFile) {
            console.log(`\n${file}`);
            printedFile = file;
        }
        try {
            await fn();
            passed++;
            console.log(`  ✓ ${name}`);
        } catch (e) {
            failed++;
            console.error(`  ✗ ${name}`);
            console.error(`    ${(e && e.message) || e}`);
        }
    }

    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
}

runAll();
