/**
 * Unit tests for cron.js — CronParser, CronDescriber, CronSchedule, expandField.
 *
 * Uses the Node.js built-in test runner (node:test) and assert module.
 * Loads cron.js via vm.runInContext so no source modifications are needed.
 *
 * Run: node --test tests/javascript/test_cron_logic.js   (from devsuite/ root)
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

// ─────────────────────────────────────────────
// Bootstrap: load cron.js into an isolated context
// ─────────────────────────────────────────────

const cronSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'static', 'cron.js'),
  'utf8'
);

// cron.js uses 'use strict' with `const` class declarations.  In a vm context
// those const bindings are scoped to the script and do NOT become properties of
// the context object.  We wrap the entire source in an IIFE that returns the
// names we need, so they can be captured from the return value.
const cronContext = {
  document: { addEventListener: () => {}, getElementById: () => null },
  window: {},
  console,
};
vm.createContext(cronContext);
const wrapped = `(function() { ${cronSource}; return { CronParser, CronDescriber, CronSchedule, DIALECTS, PRESETS }; })();`;
const { CronParser, CronDescriber, CronSchedule, DIALECTS, PRESETS } = vm.runInContext(wrapped, cronContext);

// ─────────────────────────────────────────────
// DIALECT CONSTANTS
// ─────────────────────────────────────────────

describe('DIALECTS constant', () => {
  test('unix dialect has 5 fields', () => {
    assert.equal(DIALECTS.unix.fields.length, 5);
  });

  test('quartz dialect has 7 fields (including optional year)', () => {
    assert.equal(DIALECTS.quartz.fields.length, 7);
  });

  test('aws dialect has 6 fields', () => {
    assert.equal(DIALECTS.aws.fields.length, 6);
  });

  test('github dialect has 5 fields', () => {
    assert.equal(DIALECTS.github.fields.length, 5);
  });

  test('quartz supportsHash is true', () => {
    assert.equal(DIALECTS.quartz.supportsHash, true);
  });

  test('unix supportsQuestion is false', () => {
    assert.equal(DIALECTS.unix.supportsQuestion, false);
  });

  test('aws supportsYear is true', () => {
    assert.equal(DIALECTS.aws.supportsYear, true);
  });

  test('github supportsL is false', () => {
    assert.equal(DIALECTS.github.supportsL, false);
  });
});

// ─────────────────────────────────────────────
// PRESETS
// ─────────────────────────────────────────────

describe('PRESETS', () => {
  test('unix presets array is non-empty', () => {
    assert.ok(Array.isArray(PRESETS.unix));
    assert.ok(PRESETS.unix.length > 0);
  });

  test('quartz presets array is non-empty', () => {
    assert.ok(Array.isArray(PRESETS.quartz));
    assert.ok(PRESETS.quartz.length > 0);
  });

  test('aws presets array is non-empty', () => {
    assert.ok(Array.isArray(PRESETS.aws));
    assert.ok(PRESETS.aws.length > 0);
  });

  test('github presets array is non-empty', () => {
    assert.ok(Array.isArray(PRESETS.github));
    assert.ok(PRESETS.github.length > 0);
  });

  test('each preset has label and expr properties', () => {
    for (const [dialect, presets] of Object.entries(PRESETS)) {
      for (const p of presets) {
        assert.ok(typeof p.label === 'string', `${dialect} preset missing label`);
        assert.ok(typeof p.expr === 'string', `${dialect} preset missing expr`);
      }
    }
  });

  test('unix every-minute preset expression is "* * * * *"', () => {
    const found = PRESETS.unix.find(p => p.label.toLowerCase().includes('every minute'));
    assert.ok(found, 'every-minute preset not found');
    assert.equal(found.expr, '* * * * *');
  });
});

// ─────────────────────────────────────────────
// CRONPARSER — basic parsing
// ─────────────────────────────────────────────

describe('CronParser (unix) — field count validation', () => {
  const parser = new CronParser('unix');

  test('valid 5-field expression is valid', () => {
    const result = parser.parse('* * * * *');
    assert.equal(result.valid, true);
    assert.equal(result.fields.length, 5);
  });

  test('4-field expression is invalid (too few)', () => {
    const result = parser.parse('* * * *');
    assert.equal(result.valid, false);
    assert.ok(result.error, 'error message should be present');
  });

  test('6-field expression is invalid for unix (too many)', () => {
    const result = parser.parse('* * * * * *');
    assert.equal(result.valid, false);
  });

  test('empty expression is invalid', () => {
    const result = parser.parse('');
    assert.equal(result.valid, false);
  });

  test('quartz 6-field is valid (year is optional)', () => {
    const q = new CronParser('quartz');
    const result = q.parse('0 * * * * ?');
    assert.equal(result.valid, true);
  });

  test('quartz 7-field is valid', () => {
    const q = new CronParser('quartz');
    const result = q.parse('0 0/15 9-17 ? * MON-FRI 2024');
    assert.equal(result.valid, true);
  });

  test('aws 6-field is valid', () => {
    const a = new CronParser('aws');
    const result = a.parse('0/15 9-17 ? * MON-FRI *');
    assert.equal(result.valid, true);
  });

  test('whitespace-only expression is invalid', () => {
    const result = parser.parse('   ');
    assert.equal(result.valid, false);
  });
});

// ─────────────────────────────────────────────
// CRONPARSER — wildcard token
// ─────────────────────────────────────────────

describe('CronParser — wildcard (*)', () => {
  const parser = new CronParser('unix');

  test('* parses to type wildcard', () => {
    const result = parser.parse('* * * * *');
    result.fields.forEach(f => {
      assert.equal(f.type, 'wildcard');
    });
  });

  test('wildcard field has null values', () => {
    const result = parser.parse('* * * * *');
    assert.equal(result.fields[0].values, null);
  });
});

// ─────────────────────────────────────────────
// CRONPARSER — numeric single value
// ─────────────────────────────────────────────

describe('CronParser — single numeric value', () => {
  const parser = new CronParser('unix');

  test('minute "30" parses to type value with [30]', () => {
    const result = parser.parse('30 * * * *');
    const min = result.fields[0];
    assert.equal(min.type, 'value');
    // Use element-level comparison to avoid vm-context Array prototype mismatch
    assert.equal(min.values.length, 1);
    assert.equal(min.values[0], 30);
  });

  test('minute "0" is valid', () => {
    const result = parser.parse('0 * * * *');
    assert.equal(result.valid, true);
    assert.equal(result.fields[0].values[0], 0);
  });

  test('minute "59" is valid', () => {
    const result = parser.parse('59 * * * *');
    assert.equal(result.valid, true);
  });

  test('minute "60" is invalid (out of range 0–59)', () => {
    const result = parser.parse('60 * * * *');
    assert.equal(result.valid, false);
    assert.ok(/minute|out of range/i.test(result.error));
  });

  test('minute "-1" is invalid', () => {
    const result = parser.parse('-1 * * * *');
    assert.equal(result.valid, false);
  });

  test('dom "1" is valid', () => {
    const result = parser.parse('* * 1 * *');
    assert.equal(result.valid, true);
  });

  test('dom "0" is invalid (range 1–31)', () => {
    const result = parser.parse('* * 0 * *');
    assert.equal(result.valid, false);
  });

  test('month "12" is valid', () => {
    const result = parser.parse('* * * 12 *');
    assert.equal(result.valid, true);
  });

  test('month "13" is invalid', () => {
    const result = parser.parse('* * * 13 *');
    assert.equal(result.valid, false);
  });
});

// ─────────────────────────────────────────────
// CRONPARSER — step expressions
// ─────────────────────────────────────────────

describe('CronParser — step (*/n and start/n)', () => {
  const parser = new CronParser('unix');

  test('*/15 parses to type step with start=0 step=15', () => {
    const result = parser.parse('*/15 * * * *');
    const min = result.fields[0];
    assert.equal(min.type, 'step');
    assert.equal(min.start, 0);
    assert.equal(min.step, 15);
  });

  test('0/30 parses to type step with start=0 step=30', () => {
    const result = parser.parse('0/30 * * * *');
    const min = result.fields[0];
    assert.equal(min.type, 'step');
    assert.equal(min.start, 0);
    assert.equal(min.step, 30);
  });

  test('step value of 0 is invalid', () => {
    const result = parser.parse('*/0 * * * *');
    assert.equal(result.valid, false);
  });

  test('*/1 is valid (step of 1 = every minute)', () => {
    const result = parser.parse('*/1 * * * *');
    assert.equal(result.valid, true);
    assert.equal(result.fields[0].step, 1);
  });

  test('hour step */6 is valid', () => {
    const result = parser.parse('0 */6 * * *');
    assert.equal(result.valid, true);
    const hr = result.fields[1];
    assert.equal(hr.type, 'step');
    assert.equal(hr.step, 6);
  });
});

// ─────────────────────────────────────────────
// CRONPARSER — range expressions
// ─────────────────────────────────────────────

describe('CronParser — range (a-b)', () => {
  const parser = new CronParser('unix');

  test('1-5 in dow parses to type range', () => {
    const result = parser.parse('* * * * 1-5');
    const dow = result.fields[4];
    assert.equal(dow.type, 'range');
    assert.equal(dow.start, 1);
    assert.equal(dow.end, 5);
    // Compare element-by-element to avoid vm-context Array prototype mismatch
    assert.deepEqual(Array.from(dow.values), [1, 2, 3, 4, 5]);
  });

  test('9-17 in hour parses correctly', () => {
    const result = parser.parse('* 9-17 * * *');
    const hr = result.fields[1];
    assert.equal(hr.type, 'range');
    assert.equal(hr.start, 9);
    assert.equal(hr.end, 17);
  });

  test('inverted range a > b is invalid', () => {
    const result = parser.parse('* 17-9 * * *');
    assert.equal(result.valid, false);
  });

  test('range exceeding field max is invalid', () => {
    const result = parser.parse('* 0-24 * * *');
    assert.equal(result.valid, false);
  });
});

// ─────────────────────────────────────────────
// CRONPARSER — list expressions
// ─────────────────────────────────────────────

describe('CronParser — list (a,b,c)', () => {
  const parser = new CronParser('unix');

  test('0,15,30,45 in minute parses to type list', () => {
    const result = parser.parse('0,15,30,45 * * * *');
    const min = result.fields[0];
    assert.equal(min.type, 'list');
    assert.deepEqual(Array.from(min.values), [0, 15, 30, 45]);
  });

  test('list values are deduplicated and sorted', () => {
    const result = parser.parse('5,5,3,1 * * * *');
    const min = result.fields[0];
    assert.deepEqual(Array.from(min.values), [1, 3, 5]);
  });

  test('list with out-of-range value is invalid', () => {
    const result = parser.parse('0,60,30 * * * *');
    assert.equal(result.valid, false);
  });

  test('1,4,7,10 in month (quarterly) is valid', () => {
    const result = parser.parse('0 0 1 1,4,7,10 *');
    assert.equal(result.valid, true);
    const mon = result.fields[3];
    assert.equal(mon.type, 'list');
    assert.deepEqual(Array.from(mon.values), [1, 4, 7, 10]);
  });

  test('list with range inside (1-3,5) is handled', () => {
    const result = parser.parse('* * * * 1-3,5');
    assert.equal(result.valid, true);
    const dow = result.fields[4];
    // 1,2,3,5 from 1-3 plus 5
    assert.ok(dow.values.includes(1));
    assert.ok(dow.values.includes(3));
    assert.ok(dow.values.includes(5));
  });
});

// ─────────────────────────────────────────────
// CRONPARSER — named DOW and month values
// ─────────────────────────────────────────────

describe('CronParser — named values (DOW/month)', () => {
  const parser = new CronParser('unix');

  test('MON-FRI in dow resolves to 1-5 (unix: SUN=0)', () => {
    const result = parser.parse('* * * * MON-FRI');
    assert.equal(result.valid, true);
    const dow = result.fields[4];
    assert.equal(dow.type, 'range');
    assert.equal(dow.start, 1);
    assert.equal(dow.end, 5);
  });

  test('SUN in dow resolves to 0 (unix)', () => {
    const result = parser.parse('* * * * SUN');
    assert.equal(result.valid, true);
    assert.equal(result.fields[4].values[0], 0);
  });

  test('JAN in month resolves to 1', () => {
    const result = parser.parse('* * * JAN *');
    assert.equal(result.valid, true);
    assert.equal(result.fields[3].values[0], 1);
  });

  test('DEC in month resolves to 12', () => {
    const result = parser.parse('* * * DEC *');
    assert.equal(result.valid, true);
    assert.equal(result.fields[3].values[0], 12);
  });

  test('Quartz MON-FRI resolves to 2-6 (quartz: SUN=1)', () => {
    const q = new CronParser('quartz');
    const result = q.parse('0 0/15 9-17 ? * MON-FRI');
    assert.equal(result.valid, true);
    const dow = result.fields[5];
    assert.equal(dow.type, 'range');
    assert.equal(dow.start, 2); // MON = 2 in Quartz
    assert.equal(dow.end, 6);   // FRI = 6 in Quartz
  });
});

// ─────────────────────────────────────────────
// CRONPARSER — ? (question mark) token
// ─────────────────────────────────────────────

describe('CronParser — ? (question mark)', () => {
  test('? in dom is valid for quartz', () => {
    const q = new CronParser('quartz');
    const result = q.parse('0 * * ? * *');
    assert.equal(result.valid, true);
    assert.equal(result.fields[3].type, 'question');
  });

  test('? in non-dom/dow field is invalid for quartz', () => {
    const q = new CronParser('quartz');
    const result = q.parse('0 ? * * * *');  // ? in minute field
    assert.equal(result.valid, false);
  });

  test('? in dow is valid for quartz', () => {
    const q = new CronParser('quartz');
    const result = q.parse('0 0 12 1 * ?');
    assert.equal(result.valid, true);
  });

  test('? is rejected for unix dialect', () => {
    const u = new CronParser('unix');
    const result = u.parse('* * ? * *');
    assert.equal(result.valid, false);
    assert.ok(result.error, 'error expected');
  });
});

// ─────────────────────────────────────────────
// CRONPARSER — L (last) token
// ─────────────────────────────────────────────

describe('CronParser — L (last)', () => {
  test('L in dom is valid for quartz', () => {
    const q = new CronParser('quartz');
    const result = q.parse('0 0 0 L * ?');
    assert.equal(result.valid, true);
    assert.equal(result.fields[3].type, 'last');
  });

  test('L is rejected for unix', () => {
    const u = new CronParser('unix');
    const result = u.parse('* * L * *');
    assert.equal(result.valid, false);
  });

  test('L in dow is valid for quartz', () => {
    const q = new CronParser('quartz');
    // Quartz: sec min hour dom month dow [year]. '0 0 0 ? * L' has 6 required fields.
    const result = q.parse('0 0 0 ? * L');
    assert.equal(result.valid, true);
    assert.equal(result.fields[5].type, 'last');
  });
});

// ─────────────────────────────────────────────
// CRONPARSER — # (hash/nth) token
// ─────────────────────────────────────────────

describe('CronParser — # (nth occurrence, Quartz)', () => {
  test('2#2 (2nd Monday) is valid for quartz', () => {
    const q = new CronParser('quartz');
    const result = q.parse('0 0 9 ? * 2#2');
    assert.equal(result.valid, true);
    const dow = result.fields[5];
    assert.equal(dow.type, 'hash');
    assert.equal(dow.day, 2);
    assert.equal(dow.nth, 2);
  });

  test('hash with nth > 5 is invalid', () => {
    const q = new CronParser('quartz');
    const result = q.parse('0 0 0 ? * 2#6');
    assert.equal(result.valid, false);
  });

  test('hash with nth = 0 is invalid', () => {
    const q = new CronParser('quartz');
    const result = q.parse('0 0 0 ? * 2#0');
    assert.equal(result.valid, false);
  });

  test('# is silently stripped by unix (parseInt stops at #)', () => {
    // Unix does not support hash syntax.  The _parseField code checks
    // `d.supportsHash` before entering the hash path; when false the token
    // falls through to the parseInt path which reads '2' from '2#2'.
    // The semantic is wrong but the parser considers it "valid" as value 2.
    // This test documents the actual behaviour so regressions are caught.
    const u = new CronParser('unix');
    const result = u.parse('* * * * 2#2');
    // Parsed as dow value 2 (parseInt('2#2', 10) === 2)
    assert.equal(result.valid, true);
    assert.equal(result.fields[4].values[0], 2);
  });
});

// ─────────────────────────────────────────────
// CRONPARSER — W (nearest weekday, Quartz)
// ─────────────────────────────────────────────

describe('CronParser — W (nearest weekday)', () => {
  test('15W is valid for quartz dom', () => {
    const q = new CronParser('quartz');
    const result = q.parse('0 0 9 15W * ?');
    assert.equal(result.valid, true);
    const dom = result.fields[3];
    assert.equal(dom.type, 'weekday');
  });

  test('W suffix is silently stripped by unix (parseInt stops at W)', () => {
    // Unix does not support the W (nearest weekday) suffix.  The _parseField
    // code only enters the W path when `d.supportsW` is true; for unix the
    // token falls through to parseInt which reads '15' from '15W'.
    // This test documents the actual parser behaviour.
    const u = new CronParser('unix');
    const result = u.parse('* * 15W * *');
    // Parsed as dom value 15
    assert.equal(result.valid, true);
    assert.equal(result.fields[2].values[0], 15);
  });
});

// ─────────────────────────────────────────────
// CRONPARSER — expandField
// ─────────────────────────────────────────────

describe('CronParser.expandField', () => {
  const parser = new CronParser('unix');

  test('wildcard expands to full range', () => {
    const field = { valid: true, type: 'wildcard', values: null };
    const range = { min: 0, max: 5 };
    const set = parser.expandField(field, range);
    assert.deepEqual(Array.from(set).sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]);
  });

  test('value expands to a set with that value', () => {
    const field = { valid: true, type: 'value', values: [7] };
    const set = parser.expandField(field, { min: 0, max: 59 });
    assert.ok(set.has(7));
    assert.equal(set.size, 1);
  });

  test('range [1..5] expands to {1,2,3,4,5}', () => {
    const field = { valid: true, type: 'range', values: [1, 2, 3, 4, 5], start: 1, end: 5 };
    const set = parser.expandField(field, { min: 0, max: 6 });
    assert.deepEqual(Array.from(set).sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  });

  test('step */15 expands to {0,15,30,45} for minute range', () => {
    const field = { valid: true, type: 'step', start: 0, step: 15 };
    const set = parser.expandField(field, { min: 0, max: 59 });
    assert.deepEqual(Array.from(set).sort((a, b) => a - b), [0, 15, 30, 45]);
  });

  test('step */6 expands to {0,6,12,18} for hour range', () => {
    const field = { valid: true, type: 'step', start: 0, step: 6 };
    const set = parser.expandField(field, { min: 0, max: 23 });
    assert.deepEqual(Array.from(set).sort((a, b) => a - b), [0, 6, 12, 18]);
  });

  test('last type expands to {max}', () => {
    const field = { valid: true, type: 'last', values: null };
    const set = parser.expandField(field, { min: 1, max: 31 });
    assert.deepEqual([...set], [31]);
  });

  test('invalid field expands to empty set', () => {
    const field = { valid: false, type: 'value', values: [] };
    const set = parser.expandField(field, { min: 0, max: 59 });
    assert.equal(set.size, 0);
  });

  test('list [0,15,30,45] expands correctly', () => {
    const field = { valid: true, type: 'list', values: [0, 15, 30, 45] };
    const set = parser.expandField(field, { min: 0, max: 59 });
    assert.ok(set.has(0) && set.has(15) && set.has(30) && set.has(45));
    assert.equal(set.size, 4);
  });

  test('hash #2 for nth=2 approximates days 8..14', () => {
    const field = { valid: true, type: 'hash', day: 2, nth: 2, values: null };
    const set = parser.expandField(field, { min: 1, max: 31 });
    // firstOccurrence = 1 + (2-1)*7 = 8, lastOccurrence = 14
    for (let d = 8; d <= 14; d++) assert.ok(set.has(d), `should contain ${d}`);
    assert.ok(!set.has(7), 'should not contain 7');
    assert.ok(!set.has(15), 'should not contain 15');
  });
});

// ─────────────────────────────────────────────
// CRONDESCRIBER
// ─────────────────────────────────────────────

describe('CronDescriber', () => {
  const parser = new CronParser('unix');
  const describer = new CronDescriber();

  test('invalid parsed expression returns "Invalid expression"', () => {
    const parsed = parser.parse('bad expression here');
    const desc = describer.describe(parsed, 'unix');
    assert.equal(desc, 'Invalid expression');
  });

  test('"* * * * *" describes as "Every minute"', () => {
    const parsed = parser.parse('* * * * *');
    const desc = describer.describe(parsed, 'unix');
    assert.match(desc, /every minute/i);
  });

  test('"*/15 * * * *" describes as "every 15 minutes"', () => {
    const parsed = parser.parse('*/15 * * * *');
    const desc = describer.describe(parsed, 'unix');
    assert.match(desc, /every 15 minutes/i);
  });

  test('"*/1 * * * *" describes as "every 1 minute" (singular)', () => {
    const parsed = parser.parse('*/1 * * * *');
    const desc = describer.describe(parsed, 'unix');
    assert.match(desc, /every 1 minute/i);
  });

  test('"0 * * * *" describes as "at the start of every hour"', () => {
    const parsed = parser.parse('0 * * * *');
    const desc = describer.describe(parsed, 'unix');
    assert.match(desc, /start of every hour/i);
  });

  test('"0 */6 * * *" describes as "every 6 hours"', () => {
    const parsed = parser.parse('0 */6 * * *');
    const desc = describer.describe(parsed, 'unix');
    assert.match(desc, /every 6 hours/i);
  });

  test('"0 9 * * *" describes time at 9:00 AM', () => {
    const parsed = parser.parse('0 9 * * *');
    const desc = describer.describe(parsed, 'unix');
    assert.match(desc, /9:00 AM/i);
  });

  test('"0 12 * * *" describes time at 12:00 PM', () => {
    const parsed = parser.parse('0 12 * * *');
    const desc = describer.describe(parsed, 'unix');
    assert.match(desc, /12:00 PM/i);
  });

  test('"0 0 * * *" describes time at midnight (12:00 AM)', () => {
    const parsed = parser.parse('0 0 * * *');
    const desc = describer.describe(parsed, 'unix');
    assert.match(desc, /12:00 AM/i);
  });

  test('"*/15 9-17 * * 1-5" describes minutes and day range', () => {
    const parsed = parser.parse('*/15 9-17 * * 1-5');
    const desc = describer.describe(parsed, 'unix');
    // Should mention 15 minute steps and Mon-Fri
    assert.match(desc, /every 15 minutes/i);
    assert.match(desc, /monday|mon/i);
    assert.match(desc, /friday|fri/i);
  });

  test('"0 9 * * 1-5" mentions weekday range', () => {
    const parsed = parser.parse('0 9 * * 1-5');
    const desc = describer.describe(parsed, 'unix');
    assert.match(desc, /monday|mon/i);
    assert.match(desc, /friday|fri/i);
  });

  test('"0 0 1 * *" mentions day of month', () => {
    const parsed = parser.parse('0 0 1 * *');
    const desc = describer.describe(parsed, 'unix');
    assert.match(desc, /day 1/i);
  });

  test('"0 0 1 1 *" mentions January', () => {
    const parsed = parser.parse('0 0 1 1 *');
    const desc = describer.describe(parsed, 'unix');
    assert.match(desc, /january/i);
  });

  test('"0 0 1 6 *" mentions June', () => {
    const parsed = parser.parse('0 0 1 6 *');
    const desc = describer.describe(parsed, 'unix');
    assert.match(desc, /june/i);
  });

  test('"0 0 * * 0" mentions Sunday', () => {
    const parsed = parser.parse('0 0 * * 0');
    const desc = describer.describe(parsed, 'unix');
    assert.match(desc, /sunday/i);
  });

  test('"0 0 1 1,4,7,10 *" mentions multiple months', () => {
    const parsed = parser.parse('0 0 1 1,4,7,10 *');
    const desc = describer.describe(parsed, 'unix');
    // Description should mention the months (January, April, July, October)
    assert.match(desc, /january|april|july|october/i);
  });

  test('result is always a non-empty string for valid expressions', () => {
    const exprs = ['* * * * *', '*/5 * * * *', '0 12 * * 1', '0 0 1 1 *'];
    for (const expr of exprs) {
      const parsed = parser.parse(expr);
      const desc = describer.describe(parsed, 'unix');
      assert.ok(typeof desc === 'string' && desc.length > 0, `Empty description for: ${expr}`);
    }
  });
});

// ─────────────────────────────────────────────
// CRONSCHEDULE — nextN
// ─────────────────────────────────────────────

describe('CronSchedule.nextN', () => {
  function makeSchedule(expr, dialect = 'unix') {
    const p = new CronParser(dialect);
    const parsed = p.parse(expr);
    return new CronSchedule(p, parsed, dialect);
  }

  test('invalid expression yields empty array', () => {
    const sched = makeSchedule('not valid');
    // Use .length comparison; deepEqual on cross-vm [] can fail due to prototype differences
    assert.equal(sched.nextN(5).length, 0);
  });

  test('returns Date-like objects', () => {
    const sched = makeSchedule('* * * * *');
    const runs = sched.nextN(3);
    assert.equal(runs.length, 3);
    // Date objects from the vm context have a different constructor than outer Date;
    // check for the presence of Date methods instead of using instanceof.
    runs.forEach(d => {
      assert.ok(typeof d.getTime === 'function', 'Expected a Date-like object');
      assert.ok(typeof d.getHours === 'function', 'Expected a Date-like object');
    });
  });

  test('"* * * * *" returns n consecutive minutes', () => {
    const sched = makeSchedule('* * * * *');
    const from = new Date('2025-01-15T10:00:00Z');
    const runs = sched.nextN(3, from);
    assert.equal(runs.length, 3);
    // Each run should be 1 minute apart
    assert.equal(runs[1] - runs[0], 60000);
    assert.equal(runs[2] - runs[1], 60000);
  });

  test('"0 0 * * *" returns midnight runs', () => {
    const sched = makeSchedule('0 0 * * *');
    const from = new Date('2025-01-15T00:00:00');
    // Midnight has already passed (or is exactly now), so first run is next day
    const runs = sched.nextN(3, from);
    assert.equal(runs.length, 3);
    runs.forEach(d => {
      assert.equal(d.getHours(), 0);
      assert.equal(d.getMinutes(), 0);
    });
  });

  test('"*/15 * * * *" returns times with minutes 0,15,30,45', () => {
    const sched = makeSchedule('*/15 * * * *');
    const from = new Date('2025-06-01T00:00:00');
    const runs = sched.nextN(8, from);
    assert.equal(runs.length, 8);
    runs.forEach(d => {
      assert.ok([0, 15, 30, 45].includes(d.getMinutes()), `Unexpected minute: ${d.getMinutes()}`);
    });
  });

  test('"0 9 * * 1-5" weekday runs are only Mon-Fri', () => {
    const sched = makeSchedule('0 9 * * 1-5');
    const from = new Date('2025-01-01T00:00:00'); // Wednesday
    const runs = sched.nextN(10, from);
    runs.forEach(d => {
      const dow = d.getDay(); // 0=Sun
      assert.ok(dow >= 1 && dow <= 5, `Got weekend day: ${dow}`);
      assert.equal(d.getHours(), 9);
      assert.equal(d.getMinutes(), 0);
    });
  });

  test('"0 0 1 * *" monthly runs are on day 1', () => {
    const sched = makeSchedule('0 0 1 * *');
    const from = new Date('2025-01-01T00:00:00');
    const runs = sched.nextN(5, from);
    runs.forEach(d => {
      assert.equal(d.getDate(), 1);
      assert.equal(d.getHours(), 0);
    });
  });

  test('nextN returns at most n results', () => {
    const sched = makeSchedule('* * * * *');
    const runs = sched.nextN(10);
    assert.ok(runs.length <= 10);
  });

  test('all returned dates are in the future relative to fromDate', () => {
    const from = new Date('2025-03-15T12:30:00');
    const sched = makeSchedule('*/5 * * * *');
    const runs = sched.nextN(10, from);
    runs.forEach(d => {
      assert.ok(d > from, `Date ${d} is not after ${from}`);
    });
  });

  test('"0 0 31 * *" still returns valid dates (e.g. Jan 31)', () => {
    const sched = makeSchedule('0 0 31 * *');
    const from = new Date('2025-01-01T00:00:00');
    const runs = sched.nextN(3, from);
    // Months with 31 days: Jan=1, Mar=3, May=5, Jul=7, Aug=8, Oct=10, Dec=12
    runs.forEach(d => {
      assert.equal(d.getDate(), 31);
    });
  });

  test('aws dialect "0/15 9-17 ? * MON-FRI *" returns business-hour runs', () => {
    const sched = makeSchedule('0/15 9-17 ? * MON-FRI *', 'aws');
    const from = new Date('2025-01-06T00:00:00'); // Monday
    const runs = sched.nextN(10, from);
    runs.forEach(d => {
      const h = d.getHours();
      assert.ok(h >= 9 && h <= 17, `Hour ${h} out of business hours`);
      const dow = d.getDay();
      assert.ok(dow >= 1 && dow <= 5, `Weekend day ${dow}`);
    });
  });
});

// ─────────────────────────────────────────────
// CRONPARSER — well-known example expressions
// ─────────────────────────────────────────────

describe('CronParser — well-known examples', () => {
  test('unix example "*/15 9-17 * * 1-5" is valid', () => {
    const p = new CronParser('unix');
    assert.equal(p.parse('*/15 9-17 * * 1-5').valid, true);
  });

  test('quartz example "0 0/15 9-17 ? * MON-FRI" is valid', () => {
    const q = new CronParser('quartz');
    assert.equal(q.parse('0 0/15 9-17 ? * MON-FRI').valid, true);
  });

  test('aws example "0/15 9-17 ? * MON-FRI *" is valid', () => {
    const a = new CronParser('aws');
    assert.equal(a.parse('0/15 9-17 ? * MON-FRI *').valid, true);
  });

  test('github example "*/15 9-17 * * 1-5" is valid', () => {
    const g = new CronParser('github');
    assert.equal(g.parse('*/15 9-17 * * 1-5').valid, true);
  });

  test('all PRESETS parse as valid for their respective dialect', () => {
    for (const [dialectId, presets] of Object.entries(PRESETS)) {
      const p = new CronParser(dialectId);
      for (const preset of presets) {
        const result = p.parse(preset.expr);
        assert.equal(
          result.valid,
          true,
          `Preset "${preset.label}" (${dialectId}): "${preset.expr}" should be valid. Error: ${result.error}`
        );
      }
    }
  });
});

// ─────────────────────────────────────────────
// BOUNDARY / REGRESSION TESTS
// ─────────────────────────────────────────────

describe('Boundary and regression tests', () => {
  test('expression with extra leading/trailing whitespace is handled', () => {
    const p = new CronParser('unix');
    const result = p.parse('  * * * * *  ');
    assert.equal(result.valid, true);
  });

  test('expression with multiple internal spaces is handled', () => {
    const p = new CronParser('unix');
    // Two spaces between fields
    const result = p.parse('*  *  *  *  *');
    assert.equal(result.valid, true);
  });

  test('describer returns a capitalised string', () => {
    const p = new CronParser('unix');
    const parsed = p.parse('* * * * *');
    const d = new CronDescriber();
    const desc = d.describe(parsed, 'unix');
    assert.equal(desc[0], desc[0].toUpperCase());
  });

  test('step */59 covers only 0 and 59 for minute', () => {
    const p = new CronParser('unix');
    const parsed = p.parse('*/59 * * * *');
    const field = parsed.fields[0];
    const set = p.expandField(field, { min: 0, max: 59 });
    assert.ok(set.has(0));
    assert.ok(set.has(59));
    assert.equal(set.size, 2);
  });

  test('step */60 only contains 0 (no multiples fit in 0–59)', () => {
    const p = new CronParser('unix');
    const parsed = p.parse('*/60 * * * *');
    // step 60 starting at 0: only 0 fits in range 0–59
    const field = parsed.fields[0];
    const set = p.expandField(field, { min: 0, max: 59 });
    assert.equal(set.size, 1);
    assert.ok(set.has(0));
  });

  test('DOW "6,0" (Sat + Sun) both included in unix', () => {
    const p = new CronParser('unix');
    const parsed = p.parse('0 0 * * 0,6');
    assert.equal(parsed.valid, true);
    const dowSet = p.expandField(parsed.fields[4], { min: 0, max: 6 });
    assert.ok(dowSet.has(0) && dowSet.has(6));
  });

  test('month name list "JAN,JUL,DEC" resolves to [1,7,12]', () => {
    const p = new CronParser('unix');
    const parsed = p.parse('0 0 1 JAN,JUL,DEC *');
    assert.equal(parsed.valid, true);
    const monField = parsed.fields[3];
    assert.ok(monField.values.includes(1));
    assert.ok(monField.values.includes(7));
    assert.ok(monField.values.includes(12));
  });

  test('quartz year field accepts 2099', () => {
    const q = new CronParser('quartz');
    const result = q.parse('0 0 0 1 1 ? 2099');
    assert.equal(result.valid, true);
  });

  test('aws year field 2199 is valid', () => {
    const a = new CronParser('aws');
    const result = a.parse('0 0 1 1 ? 2199');
    assert.equal(result.valid, true);
  });

  test('nextN with n=0 returns empty array', () => {
    const p = new CronParser('unix');
    const parsed = p.parse('* * * * *');
    const sched = new CronSchedule(p, parsed, 'unix');
    const runs = sched.nextN(0);
    assert.equal(runs.length, 0);
  });
});