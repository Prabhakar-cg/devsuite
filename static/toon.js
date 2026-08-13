/**
 * DevSuite — TOON (Token-Oriented Object Notation) codec
 * https://github.com/toon-format/spec
 *
 * First-party subset implementation — comma delimiter only, 2-space indent,
 * no nested tabular field-groups (falls back to list form for those; see
 * specs/016-data-linter/research.md R6-R9). Operates on the plain-JS-value
 * data model (`object`/`array`/`string`/`number`/`boolean`/`null`) shared
 * with `JSON.parse`/`jsyaml.load`.
 *
 * Pure module: no DOM access, no internal state. Loaded in the browser as
 * globalThis.Toon; require()-able in node for the unit suite in
 * tests/javascript/. Used by static/data-linter.html (TOON tab) and
 * static/file-converter.html (TOON conversion targets).
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; }
    else { root.Toon = api; }
})(globalThis, function () {
    'use strict';

    const TOON_INDENT = 2;

    function isPlainObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

    /* ── String/number formatting (encode) ── */
    function toonEscapeString(s) {
        return s.replace(/[\\"\n\r\t\x00-\x1f]/g, ch => {
            switch (ch) {
                case '\\': return '\\\\';
                case '"': return '\\"';
                case '\n': return '\\n';
                case '\r': return '\\r';
                case '\t': return '\\t';
                default: return '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
            }
        });
    }

    function toonNeedsQuote(s) {
        if (s === '') return true;
        if (/^\s|\s$/.test(s)) return true;
        if (s === 'true' || s === 'false' || s === 'null') return true;
        if (/^[+-]?[0-9]+(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?$/i.test(s)) return true;
        if (/[:"\\]/.test(s)) return true;
        if (/[[\]{}\x00-\x1f,]/.test(s)) return true;
        if (s.startsWith('-') || s.startsWith('#')) return true;
        return false;
    }

    function toonFormatString(s) {
        return toonNeedsQuote(s) ? '"' + toonEscapeString(s) + '"' : s;
    }

    function toonFormatNumber(n) {
        if (Object.is(n, -0)) n = 0;
        if (!isFinite(n)) return '0';
        return String(n);
    }

    function toonFormatPrimitive(v) {
        if (v === null || v === undefined) return 'null';
        if (typeof v === 'boolean') return v ? 'true' : 'false';
        if (typeof v === 'number') return toonFormatNumber(v);
        return toonFormatString(String(v));
    }

    function toonKeyToken(k) {
        return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(k) ? k : '"' + toonEscapeString(k) + '"';
    }

    function toonIsTabularArray(arr) {
        if (!Array.isArray(arr) || arr.length === 0) return false;
        if (!arr.every(isPlainObject)) return false;
        const keys = Object.keys(arr[0]);
        if (keys.length === 0) return false;
        return arr.every(item => {
            const ik = Object.keys(item);
            if (ik.length !== keys.length || !keys.every(k => ik.includes(k))) return false;
            return keys.every(k => { const v = item[k]; return v === null || typeof v !== 'object'; });
        });
    }

    /* ── Encoder ── */
    function toonEncode(root) {
        const lines = [];
        if (Array.isArray(root)) {
            toonEncodeArrayBody('', root, 0, lines, true);
        } else if (isPlainObject(root)) {
            for (const k of Object.keys(root)) toonEncodeField(k, root[k], 0, lines);
        } else {
            lines.push(toonFormatPrimitive(root));
        }
        return lines.join('\n');
    }

    function toonEncodeField(key, value, depth, lines) {
        const pad = ' '.repeat(TOON_INDENT * depth);
        const keyTok = toonKeyToken(key);
        if (Array.isArray(value)) {
            toonEncodeArrayBody(keyTok, value, depth, lines, false);
        } else if (isPlainObject(value)) {
            lines.push(pad + keyTok + ':');
            for (const k of Object.keys(value)) toonEncodeField(k, value[k], depth + 1, lines);
        } else {
            lines.push(pad + keyTok + ': ' + toonFormatPrimitive(value));
        }
    }

    function toonEncodeArrayBody(keyTok, arr, depth, lines, isRoot) {
        const pad = ' '.repeat(TOON_INDENT * depth);
        const n = arr.length;
        if (n === 0) {
            lines.push(pad + (isRoot ? '[]' : keyTok + ': []'));
            return;
        }
        if (arr.every(v => !isPlainObject(v) && !Array.isArray(v))) {
            lines.push(pad + (isRoot ? `[${n}]: ` : `${keyTok}[${n}]: `) + arr.map(toonFormatPrimitive).join(','));
            return;
        }
        if (toonIsTabularArray(arr)) {
            const keys = Object.keys(arr[0]);
            lines.push(pad + (isRoot ? '' : keyTok) + `[${n}]{${keys.map(toonKeyToken).join(',')}}:`);
            for (const item of arr) lines.push(pad + '  ' + keys.map(k => toonFormatPrimitive(item[k])).join(','));
            return;
        }
        lines.push(pad + (isRoot ? `[${n}]:` : `${keyTok}[${n}]:`));
        for (const item of arr) toonEncodeListItem(item, depth + 1, lines);
    }

    function toonEncodeListItem(item, depth, lines) {
        const pad = ' '.repeat(TOON_INDENT * depth);
        if (Array.isArray(item)) {
            const tmp = [];
            toonEncodeArrayBody('', item, depth, tmp, true);
            tmp.forEach((l, i) => lines.push(i === 0 ? pad + '- ' + l.slice(pad.length) : pad + '  ' + l.slice(pad.length)));
            return;
        }
        if (isPlainObject(item)) {
            const keys = Object.keys(item);
            if (keys.length === 0) { lines.push(pad + '- {}'); return; }
            const tmp = [];
            for (const k of keys) toonEncodeField(k, item[k], depth, tmp);
            tmp.forEach((l, i) => lines.push(i === 0 ? pad + '- ' + l.slice(pad.length) : pad + '  ' + l.slice(pad.length)));
            return;
        }
        lines.push(pad + '- ' + toonFormatPrimitive(item));
    }

    /* ── Decoder ── */
    function inferScalarFromText(text) {
        if (text === 'null') return null;
        if (text === 'true') return true;
        if (text === 'false') return false;
        if (/^-?[0-9]+(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?$/i.test(text) && !/^-?0[0-9]/.test(text)) return Number(text);
        return text;
    }

    function toonDecodeQuoted(tok) {
        const s = tok.slice(1, -1);
        let out = '';
        for (let i = 0; i < s.length; i++) {
            const c = s[i];
            if (c === '\\') {
                const next = s[++i];
                switch (next) {
                    case '\\': out += '\\'; break;
                    case '"': out += '"'; break;
                    case 'n': out += '\n'; break;
                    case 'r': out += '\r'; break;
                    case 't': out += '\t'; break;
                    case 'u': out += String.fromCharCode(parseInt(s.slice(i + 1, i + 5), 16)); i += 4; break;
                    default: throw new Error('Invalid escape sequence \\' + next);
                }
            } else out += c;
        }
        return out;
    }

    function toonDecodeScalar(tok) {
        tok = tok.trim();
        if (tok[0] === '"') return toonDecodeQuoted(tok);
        return inferScalarFromText(tok);
    }

    function toonSplitDelimited(str, delim) {
        const out = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < str.length; i++) {
            const c = str[i];
            if (inQuotes) {
                cur += c;
                if (c === '\\' && i + 1 < str.length) { cur += str[++i]; continue; }
                if (c === '"') inQuotes = false;
            } else if (c === '"') { inQuotes = true; cur += c; }
            else if (c === delim) { out.push(cur); cur = ''; }
            else cur += c;
        }
        out.push(cur);
        return out;
    }

    const TOON_KEY_LINE_RE = /^("(?:[^"\\]|\\.)*"|[^:[]+?)(\[(\d+)\](\{[^}]*\})?)?:(?: (.*))?$/;

    function toonParseKeyLine(text) {
        const m = TOON_KEY_LINE_RE.exec(text);
        if (!m) return null;
        const rawKey = m[1];
        const key = rawKey.startsWith('"') ? toonDecodeQuoted(rawKey) : rawKey.trim();
        const arrLen = m[3] !== undefined ? parseInt(m[3], 10) : null;
        const fieldsRaw = m[4];
        return {
            key,
            arrHeader: arrLen !== null ? { length: arrLen, fields: fieldsRaw ? fieldsRaw.slice(1, -1).split(',').map(s => s.trim()) : null } : null,
            rest: m[5] !== undefined ? m[5] : '',
        };
    }

    const TOON_BARE_ARRAY_HEADER_RE = /^(\[(\d+)\](\{[^}]*\})?):(?: (.*))?$/;

    function toonParseBareArrayHeader(text) {
        const m = TOON_BARE_ARRAY_HEADER_RE.exec(text);
        if (!m) return null;
        const fieldsRaw = m[3];
        return {
            arrHeader: { length: parseInt(m[2], 10), fields: fieldsRaw ? fieldsRaw.slice(1, -1).split(',').map(s => s.trim()) : null },
            rest: m[4] !== undefined ? m[4] : '',
        };
    }

    function toonLex(text) {
        const entries = [];
        for (const raw of text.split(/\r\n|\r|\n/)) {
            const trimmedStart = raw.replace(/^ */, '');
            if (trimmedStart === '' || trimmedStart[0] === '#') continue;
            entries.push({ indent: raw.length - trimmedStart.length, text: trimmedStart.replace(/[ \t]+$/, '') });
        }
        return entries;
    }

    function toonDecodeArrayBody(entries, pos, header, rest) {
        const { length, fields } = header;
        if (rest !== '' && rest !== undefined) return toonSplitDelimited(rest, ',').map(toonDecodeScalar);
        if (length === 0) return [];
        if (fields) {
            const rows = [];
            for (let r = 0; r < length; r++) {
                if (pos.i >= entries.length) {
                    throw new Error(`Declared ${length} tabular row(s) but only found ${r}`);
                }
                const cells = toonSplitDelimited(entries[pos.i].text, ',');
                pos.i++;
                const obj = {};
                fields.forEach((f, idx) => { obj[f] = toonDecodeScalar(cells[idx]); });
                rows.push(obj);
            }
            return rows;
        }
        const items = [];
        for (let idx = 0; idx < length; idx++) {
            if (pos.i >= entries.length) {
                throw new Error(`Declared ${length} list item(s) but only found ${idx}`);
            }
            items.push(toonDecodeListItem(entries, pos, entries[pos.i].indent));
        }
        return items;
    }

    function toonDecodeKeyedLine(kv, entries, pos, indent) {
        if (kv.arrHeader) return toonDecodeArrayBody(entries, pos, kv.arrHeader, kv.rest);
        if (kv.rest === '[]') return [];
        if (kv.rest === '') {
            if (pos.i < entries.length && entries[pos.i].indent > indent) return toonDecodeObjectAt(entries, pos, entries[pos.i].indent);
            return {};
        }
        return toonDecodeScalar(kv.rest);
    }

    function toonDecodeObjectAt(entries, pos, indent) {
        const obj = {};
        while (pos.i < entries.length && entries[pos.i].indent === indent) {
            const line = entries[pos.i];
            const kv = toonParseKeyLine(line.text);
            if (!kv) throw new Error('Malformed line: "' + line.text + '"');
            pos.i++;
            obj[kv.key] = toonDecodeKeyedLine(kv, entries, pos, indent);
        }
        return obj;
    }

    function toonDecodeListItem(entries, pos, indent) {
        const line = entries[pos.i];
        if (line.text !== '-' && !line.text.startsWith('- ')) {
            throw new Error('Expected list item ("- ...") at: "' + line.text + '"');
        }
        const content = line.text === '-' ? '' : line.text.slice(2);
        pos.i++;
        if (content === '') {
            if (pos.i < entries.length && entries[pos.i].indent > indent) return toonDecodeObjectAt(entries, pos, entries[pos.i].indent);
            return null;
        }
        if (content === '{}') return {};
        if (content === '[]') return [];
        const bareArr = toonParseBareArrayHeader(content);
        if (bareArr) return toonDecodeArrayBody(entries, pos, bareArr.arrHeader, bareArr.rest);

        const kv = toonParseKeyLine(content);
        if (kv) {
            const obj = { [kv.key]: toonDecodeKeyedLine(kv, entries, pos, indent) };
            while (pos.i < entries.length && entries[pos.i].indent === indent + TOON_INDENT) {
                const kv2 = toonParseKeyLine(entries[pos.i].text);
                if (!kv2) break;
                pos.i++;
                obj[kv2.key] = toonDecodeKeyedLine(kv2, entries, pos, indent + TOON_INDENT);
            }
            return obj;
        }
        return toonDecodeScalar(content);
    }

    function toonDecode(text) {
        const entries = toonLex(text);
        if (entries.length === 0) return {};
        const first = entries[0];
        const pos = { i: 0 };

        const bareArr = toonParseBareArrayHeader(first.text);
        if (bareArr) { pos.i = 1; return toonDecodeArrayBody(entries, pos, bareArr.arrHeader, bareArr.rest); }
        if (first.text === '[]') return [];

        if (entries.length === 1 && !toonParseKeyLine(first.text)) return toonDecodeScalar(first.text);
        return toonDecodeObjectAt(entries, pos, first.indent);
    }

    /* ── Format auto-detection helper (shared with static/data-linter.html's
       paste/Detect flow) — true if the text contains a "key[N]" / "[N]"
       bracket-length array header anywhere, TOON's one syntax marker no
       other supported format shares. ── */
    function looksLikeToonHeader(text) {
        return text.split(/\r\n|\r|\n/).some(line => {
            const t = line.replace(/^\s+/, '');
            if (t === '' || t[0] === '#') return false;
            const kv = toonParseKeyLine(t);
            if (kv && kv.arrHeader) return true;
            return !!toonParseBareArrayHeader(t);
        });
    }

    return { encode: toonEncode, decode: toonDecode, looksLikeToonHeader, inferScalarFromText };
});
