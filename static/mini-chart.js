/**
 * DevSuite MiniChart — a tiny, dependency-free canvas chart renderer.
 *
 * Why: the SSH dashboard (ssh-manager.js) was written against the Chart.js API but
 * Chart.js was never vendored, so the whole live-metrics dashboard silently never
 * rendered (updateDashboardGauges bails when `Chart` is undefined). Rather than add a
 * ~200 KB third-party library (Constitution III / SPEC §11), this implements exactly
 * the subset the dashboard uses: 'line' (filled, smoothed, fixed y-range, sparse x
 * ticks) and 'doughnut' (used/free ring with a cutout).
 *
 * API subset kept compatible with Chart.js so ssh-manager.js is unchanged:
 *   new Chart(ctx2d, { type, data: { labels, datasets: [{...}] }, options })
 *   chart.data  (mutable)   chart.update(mode)   chart.destroy()
 *   Chart.defaults.color / Chart.defaults.font.family
 *
 * Pure geometry helpers (linePoints / tickIndices / doughnutArcs) are exported for the
 * node unit suite; the drawing itself needs a canvas. Loaded as globalThis.Chart only
 * when no real Chart is present. No innerHTML, no network, no storage.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; }
    else {
        root.DevSuiteMiniChart = api;
        if (typeof root.Chart === 'undefined') { root.Chart = api.MiniChart; }
    }
})(globalThis, function () {
    'use strict';

    /** Map values to canvas points inside a plot box. A single value is centred. */
    function linePoints(values, box, min, max) {
        const n = values.length;
        const span = (max - min) || 1;
        return values.map((v, i) => {
            const clamped = Math.min(max, Math.max(min, Number(v) || 0));
            return {
                x: n === 1 ? box.x + box.w / 2 : box.x + (box.w * i) / (n - 1),
                y: box.y + box.h - ((clamped - min) / span) * box.h,
            };
        });
    }

    /** Indices of at most `maxTicks` evenly spaced labels, always including first and last. */
    function tickIndices(len, maxTicks) {
        if (len <= 0) return [];
        const m = Math.max(1, Math.min(len, maxTicks || len));
        if (m === 1) return [len - 1];
        const out = new Set();
        for (let i = 0; i < m; i++) out.add(Math.round((i * (len - 1)) / (m - 1)));
        return [...out].sort((a, b) => a - b);
    }

    /** Start/end angles (radians, clockwise from 12 o'clock) for each non-negative value. */
    function doughnutArcs(values) {
        const clean = values.map((v) => Math.max(0, Number(v) || 0));
        const total = clean.reduce((a, b) => a + b, 0);
        let angle = -Math.PI / 2;
        return clean.map((v) => {
            const sweep = total ? (v / total) * Math.PI * 2 : 0;
            const arc = { start: angle, end: angle + sweep };
            angle += sweep;
            return arc;
        });
    }

    function percent(str, fallback) {
        const n = Number.parseFloat(String(str ?? ''));
        return Number.isFinite(n) ? n / 100 : fallback;
    }

    class MiniChart {
        constructor(ctx, config) {
            this.ctx = ctx;
            this.canvas = ctx.canvas;
            this.config = config || {};
            this.data = this.config.data || { labels: [], datasets: [] };
            this.options = this.config.options || {};
            this._draw = this._draw.bind(this);
            const parent = this.canvas.parentElement;
            if (parent && typeof ResizeObserver !== 'undefined') {
                this._ro = new ResizeObserver(() => this._draw());
                this._ro.observe(parent);
            }
            this.canvas.setAttribute('role', 'img');
            this._draw();
        }

        update() { this._draw(); }

        destroy() { if (this._ro) this._ro.disconnect(); }

        _fit() {
            const parent = this.canvas.parentElement;
            const w = Math.max(40, (parent ? parent.clientWidth : this.canvas.clientWidth) || 160);
            const h = Math.max(40, (parent ? parent.clientHeight : this.canvas.clientHeight) || 100);
            const dpr = globalThis.devicePixelRatio || 1;
            if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
                this.canvas.width = Math.round(w * dpr);
                this.canvas.height = Math.round(h * dpr);
                this.canvas.style.width = w + 'px';
                this.canvas.style.height = h + 'px';
            }
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            return { w, h };
        }

        _draw() {
            const { w, h } = this._fit();
            this.ctx.clearRect(0, 0, w, h);
            const ds = (this.data.datasets || [])[0] || { data: [] };
            const latest = ds.data && ds.data.length ? ds.data[ds.data.length - 1] : '';
            this.canvas.setAttribute('aria-label', `${ds.label || this.config.type || 'chart'}: ${latest}`);
            if (this.config.type === 'doughnut') this._drawDoughnut(w, h, ds);
            else this._drawLine(w, h, ds);
        }

        _drawLine(w, h, ds) {
            const ctx = this.ctx;
            const y = ((this.options.scales || {}).y) || {};
            const xTicks = (((this.options.scales || {}).x || {}).ticks) || {};
            const min = y.min ?? 0;
            const max = y.max ?? 100;
            const padL = 28; const padB = 16; const padT = 6; const padR = 6;
            const box = { x: padL, y: padT, w: w - padL - padR, h: h - padT - padB };
            const color = MiniChart.defaults.color;
            const gridColor = ((y.grid || {}).color) || 'rgba(255,255,255,0.05)';

            ctx.font = `10px ${MiniChart.defaults.font.family || 'sans-serif'}`;
            ctx.fillStyle = color;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'right';
            ctx.lineWidth = 1;
            for (const tick of [min, (min + max) / 2, max]) {
                const ty = box.y + box.h - ((tick - min) / ((max - min) || 1)) * box.h;
                ctx.strokeStyle = gridColor;
                ctx.beginPath(); ctx.moveTo(box.x, ty); ctx.lineTo(box.x + box.w, ty); ctx.stroke();
                ctx.fillText(String(Math.round(tick)), box.x - 4, ty);
            }

            const values = ds.data || [];
            if (!values.length) return;
            const pts = linePoints(values, box, min, max);

            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = color;
            for (const i of tickIndices(values.length, xTicks.maxTicksLimit || 5)) {
                const label = (this.data.labels || [])[i];
                if (label !== undefined) ctx.fillText(String(label), Math.min(box.x + box.w - 14, Math.max(box.x + 14, pts[i].x)), box.y + box.h + 3);
            }

            const path = () => {
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) {
                    const mx = (pts[i - 1].x + pts[i].x) / 2;
                    const my = (pts[i - 1].y + pts[i].y) / 2;
                    if (ds.tension) ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mx, my);
                    else ctx.lineTo(pts[i].x, pts[i].y);
                }
                ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
            };
            if (ds.fill && pts.length > 1) {
                path();
                ctx.lineTo(pts[pts.length - 1].x, box.y + box.h);
                ctx.lineTo(pts[0].x, box.y + box.h);
                ctx.closePath();
                ctx.fillStyle = ds.backgroundColor || 'rgba(0,113,227,0.1)';
                ctx.fill();
            }
            path();
            ctx.strokeStyle = ds.borderColor || '#0071e3';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        _drawDoughnut(w, h, ds) {
            const ctx = this.ctx;
            const values = ds.data || [];
            const colors = Array.isArray(ds.backgroundColor) ? ds.backgroundColor : [ds.backgroundColor || '#0071e3'];
            const r = Math.max(10, Math.min(w, h) / 2 - 2);
            const cx = w / 2; const cy = h / 2;
            const cut = percent(ds.cutout, 0.5);
            const arcs = doughnutArcs(values);
            arcs.forEach((a, i) => {
                if (a.end <= a.start) return;
                ctx.beginPath();
                ctx.arc(cx, cy, r, a.start, a.end);
                ctx.arc(cx, cy, r * cut, a.end, a.start, true);
                ctx.closePath();
                ctx.fillStyle = colors[i % colors.length];
                ctx.fill();
            });
        }
    }

    MiniChart.defaults = { color: '#94a3b8', font: { family: '' } };

    return { MiniChart, linePoints, tickIndices, doughnutArcs };
});
