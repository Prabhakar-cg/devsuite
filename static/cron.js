/**
 * DevSuite — Cron Visualizer Logic
 * 100% vanilla JS. No external cron libraries.
 * Security: all DOM mutations use createElement + textContent, never innerHTML with user data.
 */

'use strict';

// ─────────────────────────────────────────────
// CONSTANTS & DIALECT DEFINITIONS
// ─────────────────────────────────────────────

const DIALECTS = {
  unix: {
    id: 'unix',
    label: 'Unix / Linux',
    fields: ['minute', 'hour', 'dom', 'month', 'dow'],
    fieldLabels: ['Minute', 'Hour', 'Day (Month)', 'Month', 'Day (Week)'],
    fieldRanges: [
      { min: 0, max: 59 },
      { min: 0, max: 23 },
      { min: 1, max: 31 },
      { min: 1, max: 12 },
      { min: 0, max: 6 }
    ],
    supportsQuestion: false,
    supportsL: false,
    supportsW: false,
    supportsHash: false,
    supportsYear: false,
    example: '*/15 9-17 * * 1-5',
    placeholder: 'min hour dom month dow'
  },
  quartz: {
    id: 'quartz',
    label: 'Quartz / Spring',
    fields: ['second', 'minute', 'hour', 'dom', 'month', 'dow', 'year'],
    fieldLabels: ['Second', 'Minute', 'Hour', 'Day (Month)', 'Month', 'Day (Week)', 'Year (opt)'],
    fieldRanges: [
      { min: 0, max: 59 },
      { min: 0, max: 59 },
      { min: 0, max: 23 },
      { min: 1, max: 31 },
      { min: 1, max: 12 },
      { min: 1, max: 7 },  // 1=Sun in Quartz
      { min: 1970, max: 2099 }
    ],
    supportsQuestion: true,
    supportsL: true,
    supportsW: true,
    supportsHash: true,
    supportsYear: true,
    example: '0 0/15 9-17 ? * MON-FRI',
    placeholder: 'sec min hour dom month dow [year]'
  },
  aws: {
    id: 'aws',
    label: 'AWS EventBridge',
    fields: ['minute', 'hour', 'dom', 'month', 'dow', 'year'],
    fieldLabels: ['Minute', 'Hour', 'Day (Month)', 'Month', 'Day (Week)', 'Year'],
    fieldRanges: [
      { min: 0, max: 59 },
      { min: 0, max: 23 },
      { min: 1, max: 31 },
      { min: 1, max: 12 },
      { min: 1, max: 7 },
      { min: 1970, max: 2199 }
    ],
    supportsQuestion: true,
    supportsL: true,
    supportsW: false,
    supportsHash: false,
    supportsYear: true,
    example: '0/15 9-17 ? * MON-FRI *',
    placeholder: 'min hour dom month dow year'
  },
  github: {
    id: 'github',
    label: 'GitHub Actions',
    fields: ['minute', 'hour', 'dom', 'month', 'dow'],
    fieldLabels: ['Minute', 'Hour', 'Day (Month)', 'Month', 'Day (Week)'],
    fieldRanges: [
      { min: 0, max: 59 },
      { min: 0, max: 23 },
      { min: 1, max: 31 },
      { min: 1, max: 12 },
      { min: 0, max: 6 }
    ],
    supportsQuestion: false,
    supportsL: false,
    supportsW: false,
    supportsHash: false,
    supportsYear: false,
    example: '*/15 9-17 * * 1-5',
    placeholder: 'min hour dom month dow'
  }
};

const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW_NAMES = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const DOW_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// ─────────────────────────────────────────────
// CRON PARSER
// ─────────────────────────────────────────────

class CronParser {
  constructor(dialect) {
    this.dialect = DIALECTS[dialect];
  }

  parse(expr) {
    const parts = expr.trim().split(/\s+/);
    const fields = this.dialect.fields;
    const minFields = this.dialect.supportsYear ? fields.length - 1 : fields.length;
    const maxFields = fields.length;

    if (parts.length < minFields || parts.length > maxFields) {
      const rangeStr = this.dialect.supportsYear ? `–${maxFields}` : '';
      return {
        valid: false,
        error: `Expected ${minFields}${rangeStr} fields, got ${parts.length}`,
        fields: []
      };
    }

    // Pad year field if optional and missing
    if (this.dialect.supportsYear && parts.length === minFields) {
      parts.push('*');
    }

    const results = [];
    for (let i = 0; i < parts.length; i++) {
      const result = this._parseField(parts[i], i, fields[i]);
      results.push(result);
    }

    const allValid = results.every(r => r.valid);
    return {
      valid: allValid,
      error: allValid ? null : results.find(r => !r.valid)?.error || 'Invalid expression',
      fields: results,
      parts
    };
  }

  _parseField(token, idx, fieldName) {
    const range = this.dialect.fieldRanges[idx];
    const d = this.dialect;

    const specialResult = this._parseSpecialTokens(token, fieldName, d);
    if (specialResult !== null) return specialResult;

    // Attempt to resolve named values before parsing numeric
    const resolved = this._resolveNamed(token, fieldName);

    return this._parseResolvedToken(resolved, token, range, fieldName, d);
  }

  _parseSpecialTokens(token, fieldName, d) {
    // Special tokens
    if (token === '*') return { valid: true, token, fieldName, type: 'wildcard', values: null };

    // ? wildcard (Quartz/AWS: dom and dow fields only)
    if (token === '?') {
      if (!d.supportsQuestion) {
        return { valid: false, token, fieldName, error: `'?' is not supported in ${d.label} dialect` };
      }
      if (fieldName !== 'dom' && fieldName !== 'dow') {
        return { valid: false, token, fieldName, error: `'?' is only valid in dom or dow fields` };
      }
      return { valid: true, token, fieldName, type: 'question', values: null };
    }

    // L last-day
    if (token === 'L') {
      if (!d.supportsL) return { valid: false, token, fieldName, error: `'L' not supported in ${d.label}` };
      if (fieldName !== 'dom' && fieldName !== 'dow') {
        return { valid: false, token, fieldName, error: `'L' only valid in dom or dow` };
      }
      return { valid: true, token, fieldName, type: 'last', values: null };
    }

    return null;
  }

  _parseResolvedToken(resolved, token, range, fieldName, d) {
    // Step value: */n or start/n
    if (/\//.test(resolved)) {
      return this._parseStep(resolved, range, fieldName, token);
    }

    // Range: a-b or a-b#c (Quartz hash)
    if (/#/.test(resolved) && d.supportsHash) {
      return this._parseHash(resolved, range, fieldName, token);
    }

    // W nearest weekday (Quartz)
    if (resolved.endsWith('W') && d.supportsW) {
      return this._parseWeekdayW(resolved, token, range, fieldName);
    }

    // List: a,b,c
    if (/,/.test(resolved)) {
      return this._parseList(resolved, range, fieldName, token);
    }

    // Simple range a-b
    if (/-/.test(resolved)) {
      return this._parseRange(resolved, range, fieldName, token);
    }

    // Single number
    return this._parseSingleNumber(resolved, token, range, fieldName);
  }

  _parseWeekdayW(resolved, token, range, fieldName) {
    if (fieldName !== 'dom') {
      return { valid: false, token, fieldName, error: `'W' modifier is only valid for day-of-month` };
    }
    const numStr = resolved.slice(0, -1); // strip trailing 'W'
    if (!/^\d+$/.test(numStr)) {
      return { valid: false, token, fieldName, error: `'W' requires a pure integer day number` };
    }
    const num = Number.parseInt(numStr, 10);
    if (Number.isNaN(num) || num < range.min || num > range.max) {
      return { valid: false, token, fieldName, error: `'W' requires a valid day number (${range.min}–${range.max})` };
    }
    return { valid: true, token, fieldName, type: 'weekday', values: [num] };
  }

  _parseSingleNumber(resolved, token, range, fieldName) {
    const num = this._toNumber(resolved, fieldName);
    if (Number.isNaN(num)) {
      return { valid: false, token, fieldName, error: `Unrecognised value: "${token}"` };
    }
    if (num < range.min || num > range.max) {
      return { valid: false, token, fieldName, error: `${fieldName} value ${num} out of range ${range.min}–${range.max}` };
    }
    return { valid: true, token, fieldName, type: 'value', values: [num] };
  }

  _resolveNamed(token, fieldName) {
    let t = token.toUpperCase();
    if (fieldName === 'month') {
      MONTH_NAMES.forEach((m, i) => { t = t.replaceAll(m, i + 1); });
    }
    if (fieldName === 'dow') {
      const isQuartzLike = this.dialect.id === 'quartz' || this.dialect.id === 'aws';
      // Quartz/AWS: SUN=1 .. SAT=7.  Unix/GitHub: SUN=0 .. SAT=6.
      DOW_NAMES.forEach((d, i) => {
        const val = isQuartzLike ? i + 1 : i;
        t = t.replaceAll(d, val);
      });
    }
    return t;
  }

  _toNumber(str, fieldName) {
    return Number.parseInt(str, 10);
  }

  _parseStep(token, range, fieldName, original) {
    const [startPart, stepPart] = token.split('/');
    const step = Number.parseInt(stepPart, 10);
    if (Number.isNaN(step) || step < 1) {
      return { valid: false, token: original, fieldName, error: `Invalid step value in "${original}"` };
    }
    if (startPart === '*') {
      return { valid: true, token: original, fieldName, type: 'step', start: range.min, step, values: null };
    }
    const start = Number.parseInt(startPart, 10);
    if (Number.isNaN(start) || start < range.min || start > range.max) {
      return { valid: false, token: original, fieldName, error: `Step start ${start} out of range ${range.min}–${range.max}` };
    }
    return { valid: true, token: original, fieldName, type: 'step', start, step, values: null };
  }

  _parseRange(token, range, fieldName, original) {
    const parts = token.split('-');
    if (parts.length !== 2) {
      return { valid: false, token: original, fieldName, error: `Invalid range: "${original}"` };
    }
    const [a, b] = parts.map(p => Number.parseInt(p, 10));
    if (Number.isNaN(a) || Number.isNaN(b)) {
      return { valid: false, token: original, fieldName, error: `Non-numeric range values in "${original}"` };
    }
    if (a < range.min || b > range.max || a > b) {
      return { valid: false, token: original, fieldName, error: `Range ${a}-${b} invalid for ${fieldName} (${range.min}–${range.max})` };
    }
    const values = [];
    for (let i = a; i <= b; i++) values.push(i);
    return { valid: true, token: original, fieldName, type: 'range', start: a, end: b, values };
  }

  _parseList(token, range, fieldName, original) {
    const items = token.split(',').map(s => s.trim());
    const values = [];
    for (const item of items) {
      // Delegate step tokens (*/n or start/n) to _parseStep
      if (item.includes('/')) {
        const sub = this._parseStep(item, range, fieldName, item);
        if (!sub.valid) return { valid: false, token: original, fieldName, error: sub.error };
        this.expandField(sub, range).forEach(v => values.push(v));
        continue;
      }
      // Delegate range tokens (a-b) to _parseRange
      if (/^\d+-\d+$/.test(item)) {
        const sub = this._parseRange(item, range, fieldName, item);
        if (!sub.valid) return { valid: false, token: original, fieldName, error: sub.error };
        sub.values.forEach(v => values.push(v));
        continue;
      }
      // Plain integer
      const n = Number.parseInt(item, 10);
      if (Number.isNaN(n) || n < range.min || n > range.max) {
        return { valid: false, token: original, fieldName, error: `List value "${item}" invalid for ${fieldName} (${range.min}–${range.max})` };
      }
      values.push(n);
    }
    return { valid: true, token: original, fieldName, type: 'list', values: [...new Set(values)].sort((a, b) => a - b) };
  }

  _parseHash(token, range, fieldName, original) {
    const [dayPart, nthPart] = token.split('#');
    const day = Number.parseInt(dayPart, 10);
    const nth = Number.parseInt(nthPart, 10);
    if (Number.isNaN(day) || Number.isNaN(nth) || nth < 1 || nth > 5) {
      return { valid: false, token: original, fieldName, error: `Invalid # expression: "${original}"` };
    }
    return { valid: true, token: original, fieldName, type: 'hash', day, nth, values: null };
  }

  /**
   * Expand a parsed field result into a Set of matching numbers for a given unit range.
   */
  expandField(result, range) {
    if (!result.valid) return new Set();
    switch (result.type) {
      case 'wildcard':
      case 'question': {
        const s = new Set();
        for (let i = range.min; i <= range.max; i++) s.add(i);
        return s;
      }
      case 'value':
      case 'list':
      case 'range':
        return new Set(result.values);
      case 'step': {
        const s = new Set();
        for (let i = result.start; i <= range.max; i += result.step) s.add(i);
        return s;
      }
      case 'last':
        // Map to the last valid value in the supplied range (e.g. day 31, or DOW 6/7)
        return new Set([range.max]);
      case 'weekday': {
        // Nearest weekday to result.value within range.min..range.max.
        // We include the target day and its immediate neighbours that are within range.
        const s = new Set();
        const target = result.values[0];
        for (const offset of [0, -1, 1, -2, 2]) {
          const v = target + offset;
          if (v >= range.min && v <= range.max) { s.add(v); break; }
        }
        return s;
      }
      case 'hash': {
        // #N means the Nth occurrence of `result.day` in a month;
        // for heatmap/schedule purposes we approximate: include day values
        // that could be the result.nth occurrence (days 1+(nth-1)*7 .. 7*nth).
        const s = new Set();
        const firstOccurrence = 1 + (result.nth - 1) * 7;
        const lastOccurrence  = 7 * result.nth;
        for (let d = Math.max(range.min, firstOccurrence); d <= Math.min(range.max, lastOccurrence); d++) {
          s.add(d);
        }
        return s;
      }
      default:
        return new Set();
    }
  }
}

// ─────────────────────────────────────────────
// HUMAN-READABLE DESCRIBER
// ─────────────────────────────────────────────

class CronDescriber {
  describe(parsed, dialectId) {
    if (!parsed.valid) return 'Invalid expression';
    const d = DIALECTS[dialectId];
    const fields = parsed.fields;

    const { minIdx, hourIdx, domIdx, monIdx, dowIdx } = this._fieldIndexes(d, dialectId);

    const minute = fields[minIdx];
    const hour = fields[hourIdx];
    const dom = fields[domIdx];
    const month = fields[monIdx];
    const dow = fields[dowIdx];

    const parts = [];
    parts.push(this._describeFrequency(minute, hour));

    this._appendDayParts(parts, dow, dom, month);

    return parts.length ? this._capitalize(parts.join(', ')) : 'Every minute';
  }

  _fieldIndexes(d, dialectId) {
    // Quartz with seconds field
    if ((dialectId === 'quartz') && d.fields[0] === 'second') {
      return { secIdx: 0, minIdx: 1, hourIdx: 2, domIdx: 3, monIdx: 4, dowIdx: 5 };
    }
    // All other dialects (unix, aws, github, quartz without sec)
    return { secIdx: -1, minIdx: 0, hourIdx: 1, domIdx: 2, monIdx: 3, dowIdx: 4 };
  }

  _plural(n, unit) {
    return n === 1 ? `every ${n} ${unit}` : `every ${n} ${unit}s`;
  }

  _describeFrequency(minute, hour) {
    if (minute.type === 'wildcard' && hour.type === 'wildcard') {
      return 'every minute';
    }
    if (minute.type === 'step' && minute.start === 0 && hour.type === 'wildcard') {
      return this._plural(minute.step, 'minute');
    }
    if (minute.type === 'value' && minute.values[0] === 0 && hour.type === 'step') {
      return this._plural(hour.step, 'hour');
    }
    if (minute.type === 'value' && minute.values[0] === 0 && hour.type === 'wildcard') {
      return 'at the start of every hour';
    }
    if (minute.type === 'value' && hour.type === 'value') {
      return this._describeExactTime(hour.values[0], minute.values[0]);
    }
    if (minute.type === 'step') {
      const freq = this._plural(minute.step, 'minute');
      if (hour.type === 'range') {
        return `${freq} between ${this._hourLabel(hour.start)} and ${this._hourLabel(hour.end)}`;
      }
      return freq;
    }
    return this._describeField(minute, 'minute') + ' past ' + this._describeField(hour, 'hour');
  }

  _describeExactTime(h, m) {
    const ampm = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 || 12;
    return `at ${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  _appendDayParts(parts, dow, dom, month) {
    if (dow && dow.type !== 'wildcard' && dow.type !== 'question') {
      parts.push('on ' + this._describeDow(dow));
    }
    if (dom && dom.type !== 'wildcard' && dom.type !== 'question') {
      parts.push('on day ' + this._describeField(dom, 'dom'));
    }
    if (month && month.type !== 'wildcard') {
      parts.push('in ' + this._describeMonth(month));
    }
  }

  _capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  _hourLabel(h) {
    const ampm = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 || 12;
    return `${h12}:00 ${ampm}`;
  }

  _describeField(field, name) {
    if (!field) return '*';
    switch (field.type) {
      case 'wildcard': return 'every ' + name;
      case 'value': return String(field.values[0]);
      case 'list': return field.values.join(', ');
      case 'range': return `${field.start}–${field.end}`;
      case 'step': return `every ${field.step} ${name}s`;
      default: return field.token;
    }
  }

  _describeDow(field) {
    switch (field.type) {
      case 'range': return `${DOW_FULL[field.start] || field.start} through ${DOW_FULL[field.end] || field.end}`;
      case 'list': return field.values.map(v => DOW_FULL[v] || v).join(', ');
      case 'value': return DOW_FULL[field.values[0]] || String(field.values[0]);
      default: return field.token;
    }
  }

  _describeMonth(field) {
    switch (field.type) {
      case 'range': return `${MONTH_FULL[field.start - 1]} through ${MONTH_FULL[field.end - 1]}`;
      case 'list': return field.values.map(v => MONTH_FULL[v - 1]).join(', ');
      case 'value': return MONTH_FULL[field.values[0] - 1];
      default: return field.token;
    }
  }
}

// ─────────────────────────────────────────────
// NEXT-RUN SCHEDULER
// ─────────────────────────────────────────────

class CronSchedule {
  constructor(parser, parsedResult, dialectId) {
    this.parser = parser;
    this.parsed = parsedResult;
    this.dialectId = dialectId;
    this.dialect = DIALECTS[dialectId];
  }

  /**
   * Compute next N run times from `fromDate`.
   * Uses brute-force minute iteration (max 1 year ahead = 525960 iterations).
   */
  nextN(n = 10, fromDate = new Date()) {
    if (!this.parsed.valid) return [];
    const d = this.dialect;
    const fields = this.parsed.fields;

    // Determine field indexes
    let minIdx, hourIdx, domIdx, monIdx, dowIdx;
    const fieldNames = d.fields;
    minIdx = fieldNames.indexOf('minute');
    hourIdx = fieldNames.indexOf('hour');
    domIdx = fieldNames.indexOf('dom');
    monIdx = fieldNames.indexOf('month');
    dowIdx = fieldNames.indexOf('dow');

    if (minIdx === -1 || hourIdx === -1) return [];

    const minRange = d.fieldRanges[minIdx];
    const hourRange = d.fieldRanges[hourIdx];
    const domRange = d.fieldRanges[domIdx];
    const monRange = d.fieldRanges[monIdx];
    const dowRange = d.fieldRanges[dowIdx];

    const matchMin = minIdx >= 0 ? this.parser.expandField(fields[minIdx], minRange) : null;
    const matchHour = hourIdx >= 0 ? this.parser.expandField(fields[hourIdx], hourRange) : null;
    const matchDom = domIdx >= 0 ? this.parser.expandField(fields[domIdx], domRange) : null;
    const matchMon = monIdx >= 0 ? this.parser.expandField(fields[monIdx], monRange) : null;
    const matchDow = dowIdx >= 0 ? this.parser.expandField(fields[dowIdx], dowRange) : null;

    const results = [];
    // Start from next minute
    const cursor = new Date(fromDate);
    cursor.setSeconds(0, 0);
    cursor.setMinutes(cursor.getMinutes() + 1);

    const MAX_ITER = 60 * 24 * 366; // 1 year of minutes
    for (let i = 0; i < MAX_ITER && results.length < n; i++) {
      const month = cursor.getMonth() + 1; // 1-based
      const dom = cursor.getDate();
      const rawDow = cursor.getDay(); // 0=Sun..6=Sat (JS)
      let dow;
      if (this.dialect.id === 'quartz' || this.dialect.id === 'aws') {
        dow = rawDow === 0 ? 7 : rawDow; // map to 1=Sun..7=Sat for Quartz/AWS
      } else {
        dow = rawDow;
      }
      const hour = cursor.getHours();
      const min = cursor.getMinutes();

      if (
        (!matchMon || matchMon.has(month)) &&
        (!matchDom || matchDom.has(dom)) &&
        (!matchDow || matchDow.has(dow)) &&
        (!matchHour || matchHour.has(hour)) &&
        (!matchMin || matchMin.has(min))
      ) {
        results.push(new Date(cursor));
      }

      cursor.setMinutes(cursor.getMinutes() + 1);
    }

    return results;
  }
}

// ─────────────────────────────────────────────
// PRESET LIBRARY
// ─────────────────────────────────────────────

const PRESETS = {
  unix: [
    { label: 'Every minute',         expr: '* * * * *' },
    { label: 'Every 5 minutes',      expr: '*/5 * * * *' },
    { label: 'Every 15 minutes',     expr: '*/15 * * * *' },
    { label: 'Every 30 minutes',     expr: '*/30 * * * *' },
    { label: 'Every hour',           expr: '0 * * * *' },
    { label: 'Every 6 hours',        expr: '0 */6 * * *' },
    { label: 'Daily at midnight',    expr: '0 0 * * *' },
    { label: 'Daily at noon',        expr: '0 12 * * *' },
    { label: 'Weekdays at 9 AM',     expr: '0 9 * * 1-5' },
    { label: 'Business hours (Mon–Fri 9–17)', expr: '0 9-17 * * 1-5' },
    { label: 'Weekly (Mon midnight)', expr: '0 0 * * 1' },
    { label: 'Monthly (1st midnight)', expr: '0 0 1 * *' },
    { label: 'Quarterly (1st Jan/Apr/Jul/Oct)', expr: '0 0 1 1,4,7,10 *' },
    { label: 'Yearly (Jan 1st midnight)', expr: '0 0 1 1 *' },
  ],
  quartz: [
    { label: 'Every second',         expr: '* * * * * ?' },
    { label: 'Every minute',         expr: '0 * * * * ?' },
    { label: 'Every 5 minutes',      expr: '0 0/5 * * * ?' },
    { label: 'Every 15 minutes',     expr: '0 0/15 * * * ?' },
    { label: 'Daily at midnight',    expr: '0 0 0 * * ?' },
    { label: 'Weekdays 9–17 (every 15 min)', expr: '0 0/15 9-17 ? * MON-FRI' },
    { label: 'Last day of month',    expr: '0 0 0 L * ?' },
    { label: 'First weekday of month', expr: '0 0 9 1W * ?' },
    { label: '2nd Monday of month',  expr: '0 0 9 ? * 2#2' },
  ],
  aws: [
    { label: 'Every 5 minutes',      expr: '0/5 * * * ? *' },
    { label: 'Every hour',           expr: '0 * * * ? *' },
    { label: 'Daily midnight UTC',   expr: '0 0 * * ? *' },
    { label: 'Weekdays 9 AM UTC',    expr: '0 9 ? * MON-FRI *' },
    { label: 'Monthly 1st midnight', expr: '0 0 1 * ? *' },
    { label: 'Yearly Jan 1st',       expr: '0 0 1 1 ? *' },
  ],
  github: [
    { label: 'Every 5 minutes',      expr: '*/5 * * * *' },
    { label: 'Daily at midnight UTC', expr: '0 0 * * *' },
    { label: 'Weekdays 9 AM UTC',    expr: '0 9 * * 1-5' },
    { label: 'Every Monday 8 AM',    expr: '0 8 * * 1' },
    { label: 'Monthly 1st',          expr: '0 0 1 * *' },
    { label: 'Nightly at 2 AM UTC',  expr: '0 2 * * *' },
  ]
};

// ─────────────────────────────────────────────
// MAIN UI CONTROLLER
// ─────────────────────────────────────────────

class CronVisualizer {
  currentDialect = 'unix';
  describer = new CronDescriber();
  parsed = null;
  debounceTimer = null;

  constructor() {
    this.parser = new CronParser(this.currentDialect);

    this._bindElements();
    this._bindEvents();
    this._renderDialect();
    this._parseAndUpdate();
  }

  _bindElements() {
    this.exprInput       = document.getElementById('cron-input');
    this.statusPill      = document.getElementById('cron-status');
    this.descOutput      = document.getElementById('cron-description');
    this.fieldsDisplay   = document.getElementById('cron-fields-display');
    this.nextRunsList    = document.getElementById('next-runs-list');
    this.heatmapContainer = document.getElementById('cron-heatmap');
    this.builderContainer = document.getElementById('field-builder');
    this.dialectBtns     = document.querySelectorAll('.dialect-btn');
    this.presetList      = document.getElementById('preset-list');
    this.copyExprBtn     = document.getElementById('copy-expr-btn');
    this.copyYamlBtn     = document.getElementById('copy-yaml-btn');
    this.copyJsonBtn     = document.getElementById('copy-json-btn');
    this.copyRunsBtn     = document.getElementById('copy-runs-btn');
  }

  _bindEvents() {
    // Set initial aria-pressed on the already-active dialect button
    this.dialectBtns.forEach(b => {
      b.setAttribute('aria-pressed', b.classList.contains('active') ? 'true' : 'false');
    });

    // Dialect switching
    this.dialectBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentDialect = btn.dataset.dialect;
        this.parser = new CronParser(this.currentDialect);
        this.dialectBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        const d = DIALECTS[this.currentDialect];
        this.exprInput.placeholder = d.placeholder;
        this.exprInput.value = d.example;
        this._renderDialect();
        this._parseAndUpdate();
      });
    });

    // Live input parsing
    this.exprInput.addEventListener('input', () => {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this._parseAndUpdate(), 200);
    });

    // Copy buttons
    if (this.copyExprBtn) this.copyExprBtn.addEventListener('click', () => this._copyExpr());
    if (this.copyYamlBtn) this.copyYamlBtn.addEventListener('click', () => this._copyYaml());
    if (this.copyJsonBtn) this.copyJsonBtn.addEventListener('click', () => this._copyJson());
    if (this.copyRunsBtn) this.copyRunsBtn.addEventListener('click', () => this._copyRuns());
  }

  _renderDialect() {
    // Render presets
    this._renderPresets();
  }

  _parseAndUpdate() {
    const expr = this.exprInput ? this.exprInput.value.trim() : '';
    this.parsed = this.parser.parse(expr);

    this._updateStatusPill();
    this._updateDescription();
    this._updateFieldsDisplay();
    this._updateNextRuns();
    this._updateHeatmap();
    this._updateFieldBuilder();
  }

  _updateStatusPill() {
    if (!this.statusPill) return;
    this.statusPill.className = 'status-pill';
    if (!this.exprInput.value.trim()) {
      this.statusPill.textContent = '– Empty';
      this.statusPill.classList.add('status-empty');
      return;
    }
    if (this.parsed.valid) {
      this.statusPill.textContent = '✓ Valid';
      this.statusPill.classList.add('status-valid');
    } else {
      this.statusPill.textContent = '✗ Invalid';
      this.statusPill.classList.add('status-invalid');
    }
  }

  // S7757: negated condition helpers replaced with positive form above

  _updateDescription() {
    if (!this.descOutput) return;
    if (!this.parsed.valid) {
      this.descOutput.textContent = this.parsed.error || 'Invalid expression';
      this.descOutput.className = 'desc-output desc-error';
      return;
    }
    this.descOutput.textContent = this.describer.describe(this.parsed, this.currentDialect);
    this.descOutput.className = 'desc-output';
  }

  _updateFieldsDisplay() {
    if (!this.fieldsDisplay) return;
    this.fieldsDisplay.innerHTML = '';
    if (!this.parsed.fields.length) return;

    const d = DIALECTS[this.currentDialect];
    this.parsed.fields.forEach((field, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'field-chip' + (field.valid ? '' : ' field-chip-error');

      const label = document.createElement('span');
      label.className = 'field-chip-label';
      label.textContent = d.fieldLabels[i] || d.fields[i];

      const value = document.createElement('span');
      value.className = 'field-chip-value';
      value.textContent = field.token;

      wrap.appendChild(label);
      wrap.appendChild(value);
      if (!field.valid) {
        const err = document.createElement('span');
        err.className = 'field-chip-err-msg';
        err.textContent = field.error;
        wrap.appendChild(err);
      }
      this.fieldsDisplay.appendChild(wrap);
    });
  }

  _updateNextRuns() {
    if (!this.nextRunsList) return;
    this.nextRunsList.innerHTML = '';

    if (!this.parsed.valid) {
      const li = document.createElement('li');
      li.className = 'run-item run-empty';
      li.textContent = 'Fix expression to see upcoming runs';
      this.nextRunsList.appendChild(li);
      return;
    }

    const schedule = new CronSchedule(this.parser, this.parsed, this.currentDialect);
    const times = schedule.nextN(10);

    if (!times.length) {
      const li = document.createElement('li');
      li.className = 'run-item run-empty';
      li.textContent = 'No upcoming runs found in the next year';
      this.nextRunsList.appendChild(li);
      return;
    }

    times.forEach((t, idx) => {
      const li = document.createElement('li');
      li.className = 'run-item';

      const num = document.createElement('span');
      num.className = 'run-num';
      num.textContent = String(idx + 1).padStart(2, '0');

      const dateStr = document.createElement('span');
      dateStr.className = 'run-date';
      dateStr.textContent = t.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

      const timeStr = document.createElement('span');
      timeStr.className = 'run-time';
      timeStr.textContent = t.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

      const relStr = document.createElement('span');
      relStr.className = 'run-rel';
      relStr.textContent = this._relativeTime(t);

      li.appendChild(num);
      li.appendChild(dateStr);
      li.appendChild(timeStr);
      li.appendChild(relStr);
      this.nextRunsList.appendChild(li);
    });

    // Store for copy
    this._lastRuns = times;
  }

  _relativeTime(date) {
    const diff = date - Date.now();
    const min = Math.floor(diff / 60000);
    if (min < 60) return `in ${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `in ${hr}h`;
    const days = Math.floor(hr / 24);
    return `in ${days}d`;
  }

  _updateHeatmap() {
    if (!this.heatmapContainer) return;
    this.heatmapContainer.innerHTML = '';

    if (!this.parsed.valid) return;

    const schedule = new CronSchedule(this.parser, this.parsed, this.currentDialect);

    // Build heatmap for next 28 days (4 weeks)
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    // Count fires per day for next 28 days
    const dayCounts = new Array(28).fill(0);
    const times = schedule.nextN(500, startOfDay);
    times.forEach(t => {
      const diff = Math.floor((t - startOfDay) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff < 28) dayCounts[diff]++;
    });

    const maxCount = Math.max(...dayCounts, 1);

    // Header row (day labels)
    const header = document.createElement('div');
    header.className = 'heatmap-header';
    DOW_NAMES.forEach(name => {
      const cell = document.createElement('div');
      cell.className = 'heatmap-dow-label';
      cell.textContent = name;
      header.appendChild(cell);
    });
    this.heatmapContainer.appendChild(header);

    // Grid
    const grid = document.createElement('div');
    grid.className = 'heatmap-grid';

    // Offset for first day of range
    const startDow = startOfDay.getDay(); // 0=Sun
    for (let offset = 0; offset < startDow; offset++) {
      const blank = document.createElement('div');
      blank.className = 'heatmap-cell heatmap-blank';
      grid.appendChild(blank);
    }

    for (let day = 0; day < 28; day++) {
      const d = new Date(startOfDay);
      d.setDate(d.getDate() + day);
      const count = dayCounts[day];
      const intensity = count === 0 ? 0 : Math.ceil((count / maxCount) * 4);

      const cell = document.createElement('div');
      cell.className = `heatmap-cell heatmap-intensity-${intensity}`;

      const dateLabel = document.createElement('span');
      dateLabel.className = 'heatmap-date';
      dateLabel.textContent = d.getDate();

      const countLabel = document.createElement('span');
      countLabel.className = 'heatmap-count';
      countLabel.textContent = count > 0 ? `×${count}` : '';

      cell.appendChild(dateLabel);
      cell.appendChild(countLabel);

      // Tooltip via data attr (safe, no innerHTML)
      cell.dataset.tooltip = `${d.toDateString()}: ${count} run${count === 1 ? '' : 's'}`;
      cell.addEventListener('mouseenter', (e) => this._showTooltip(e, cell.dataset.tooltip));
      cell.addEventListener('mouseleave', () => this._hideTooltip());

      grid.appendChild(cell);
    }

    this.heatmapContainer.appendChild(grid);

    // Legend
    const legend = document.createElement('div');
    legend.className = 'heatmap-legend';
    const legendLabel = document.createElement('span');
    legendLabel.textContent = 'Less';
    legend.appendChild(legendLabel);
    for (let i = 0; i <= 4; i++) {
      const sq = document.createElement('div');
      sq.className = `heatmap-legend-sq heatmap-intensity-${i}`;
      legend.appendChild(sq);
    }
    const legendLabel2 = document.createElement('span');
    legendLabel2.textContent = 'More';
    legend.appendChild(legendLabel2);
    this.heatmapContainer.appendChild(legend);
  }

  _showTooltip(e, text) {
    const existing = document.getElementById('cron-tooltip');
    const tip = existing ?? this._createTooltipEl();
    tip.textContent = text;
    tip.style.display = 'block';
    const rect = e.target.getBoundingClientRect();
    tip.style.left = (rect.left + globalThis.scrollX) + 'px';
    tip.style.top = (rect.top + globalThis.scrollY - 36) + 'px';
  }

  _createTooltipEl() {
    const tip = document.createElement('div');
    tip.id = 'cron-tooltip';
    tip.className = 'cron-tooltip';
    document.body.appendChild(tip);
    return tip;
  }

  _hideTooltip() {
    const tip = document.getElementById('cron-tooltip');
    if (tip) tip.style.display = 'none';
  }

  _updateFieldBuilder() {
    if (!this.builderContainer) return;
    this.builderContainer.innerHTML = '';

    const d = DIALECTS[this.currentDialect];
    // Only render minute, hour, month, dow grids (dom grid is too large, per UX)
    const renderFields = [
      { key: 'minute', label: 'Minute', idx: d.fields.indexOf('minute'), min: 0, max: 59, cols: 12 },
      { key: 'hour',   label: 'Hour',   idx: d.fields.indexOf('hour'),   min: 0, max: 23, cols: 6 },
      { key: 'month',  label: 'Month',  idx: d.fields.indexOf('month'),  min: 1, max: 12, cols: 6, names: MONTH_NAMES },
      { key: 'dow',    label: 'Day of Week', idx: d.fields.indexOf('dow'), min: 0, max: 6, cols: 7, names: DOW_NAMES },
    ].filter(f => f.idx !== -1);

    renderFields.forEach(def => {
      const section = document.createElement('div');
      section.className = 'builder-section';

      const heading = document.createElement('div');
      heading.className = 'builder-label';
      heading.textContent = def.label;
      section.appendChild(heading);

      const grid = document.createElement('div');
      grid.className = 'builder-grid';
      grid.style.setProperty('--cols', def.cols);

      const parsedField = this.parsed.fields[def.idx];
      const activeSet = parsedField?.valid
        ? this.parser.expandField(parsedField, { min: def.min, max: def.max })
        : new Set();

      for (let v = def.min; v <= def.max; v++) {
        const btn = document.createElement('button');
        btn.className = 'builder-cell' + (activeSet.has(v) ? ' builder-cell-active' : '');
        btn.textContent = def.names ? def.names[v - def.min] : String(v).padStart(def.max > 9 ? 2 : 1, '0');
        btn.dataset.value = v;
        btn.dataset.fieldIdx = def.idx;
        btn.addEventListener('click', () => this._onBuilderCellClick(def, v, btn));
        grid.appendChild(btn);
      }

      section.appendChild(grid);
      this.builderContainer.appendChild(section);
    });
  }

  _onBuilderCellClick(def, value, btn) {
    // Toggle this value in the expression
    const parts = (this.exprInput.value.trim() || DIALECTS[this.currentDialect].example).split(/\s+/);
    while (parts.length < DIALECTS[this.currentDialect].fields.length) parts.push('*');
    const currentToken = parts[def.idx] || '*';

    // Parse current values for this field
    const range = { min: def.min, max: def.max };
    const parsedField = this.parser._parseField(currentToken, def.idx, DIALECTS[this.currentDialect].fields[def.idx]);
    const currentSet = this.parser.expandField(parsedField, range);

    if (currentToken === '*') {
      // Switch from wildcard: select only this value
      parts[def.idx] = String(value);
    } else {
      if (currentSet.has(value)) {
        currentSet.delete(value);
      } else {
        currentSet.add(value);
      }
      if (currentSet.size === 0 || currentSet.size === (def.max - def.min + 1)) {
        parts[def.idx] = '*';
      } else {
        const sorted = [...currentSet].sort((a, b) => a - b);
        // Try to represent as a step or range if possible
        parts[def.idx] = sorted.join(',');
      }
    }

    this.exprInput.value = parts.join(' ');
    this._parseAndUpdate();
  }

  _renderPresets() {
    if (!this.presetList) return;
    this.presetList.innerHTML = '';
    const presets = PRESETS[this.currentDialect] || [];
    presets.forEach(p => {
      const item = document.createElement('button');
      item.className = 'preset-item';

      const label = document.createElement('span');
      label.className = 'preset-label';
      label.textContent = p.label;

      const code = document.createElement('code');
      code.className = 'preset-code';
      code.textContent = p.expr;

      item.appendChild(label);
      item.appendChild(code);
      item.addEventListener('click', () => {
        this.exprInput.value = p.expr;
        this._parseAndUpdate();
        // Scroll to input
        this.exprInput.focus();
        this.exprInput.select();
        this._showGlobalToast('Preset loaded!', 'success');
      });
      this.presetList.appendChild(item);
    });
  }

  // ── Export methods ──

  _copyExpr() {
    const expr = this.exprInput.value.trim();
    if (!expr) return;
    this._copyToClipboard(expr, 'Expression copied!');
  }

  _copyYaml() {
    const expr = this.exprInput.value.trim();
    if (!expr || !this.parsed.valid) return;
    let yaml;
    if (this.currentDialect === 'github') {
      yaml = `on:\n  schedule:\n    - cron: '${expr}'`;
    } else {
      // K8s CronJob format uses standard cron
      yaml = `apiVersion: batch/v1\nkind: CronJob\nmetadata:\n  name: my-cronjob\nspec:\n  schedule: "${expr}"\n  jobTemplate:\n    spec:\n      template:\n        spec:\n          containers:\n          - name: my-job\n            image: busybox:latest`;
    }
    this._copyToClipboard(yaml, 'YAML snippet copied!');
  }

  _copyJson() {
    const expr = this.exprInput.value.trim();
    if (!expr || !this.parsed.valid) return;
    const obj = {
      ScheduleExpression: this.currentDialect === 'aws' ? `cron(${expr})` : expr,
      Description: this.describer.describe(this.parsed, this.currentDialect),
      State: 'ENABLED'
    };
    this._copyToClipboard(JSON.stringify(obj, null, 2), 'JSON copied!');
  }

  _copyRuns() {
    if (!this._lastRuns || !this._lastRuns.length) return;
    const text = this._lastRuns.map(t => t.toLocaleString()).join('\n');
    this._copyToClipboard(text, 'Run times copied!');
  }

  _copyToClipboard(text, successMsg) {
    navigator.clipboard.writeText(text).then(() => {
      this._showGlobalToast(successMsg, 'success');
    }).catch(() => {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this._showGlobalToast(successMsg, 'success');
    });
  }

  _showGlobalToast(msg, type = 'info') {
    // Use the global showToast if available (from theme.js), otherwise simple fallback
    if (typeof showToast === 'function') {
      showToast(msg, type);
      return;
    }
    let toast = document.getElementById('cron-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'cron-toast';
      toast.className = 'cron-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = 'cron-toast cron-toast-show cron-toast-' + type;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.className = 'cron-toast';
    }, 2500);
  }
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  window._cronViz = new CronVisualizer();
});
