/** Unit tests for static/mini-chart.js — pure geometry helpers behind the SSH dashboard charts. */
'use strict';

const assert = require('node:assert/strict');
const { linePoints, tickIndices, doughnutArcs, MiniChart } = require('../../static/mini-chart.js');

const BOX = { x: 10, y: 5, w: 100, h: 50 };

test('linePoints maps min to the bottom and max to the top of the plot box', () => {
    const [lo, hi] = linePoints([0, 100], BOX, 0, 100);
    assert.deepEqual(lo, { x: 10, y: 55 });
    assert.deepEqual(hi, { x: 110, y: 5 });
});

test('linePoints spaces points evenly across the width', () => {
    const pts = linePoints([10, 20, 30], BOX, 0, 100);
    assert.deepEqual(pts.map((p) => p.x), [10, 60, 110]);
});

test('linePoints centres a single point and clamps out-of-range / non-numeric values', () => {
    assert.equal(linePoints([50], BOX, 0, 100)[0].x, 60);
    const [over, under, junk] = linePoints([150, -20, 'abc'], BOX, 0, 100);
    assert.equal(over.y, 5);
    assert.equal(under.y, 55);
    assert.equal(junk.y, 55);
});

test('linePoints tolerates a degenerate range', () => {
    assert.ok(Number.isFinite(linePoints([5], BOX, 5, 5)[0].y));
});

test('tickIndices always includes first and last and never exceeds the limit', () => {
    const t = tickIndices(30, 5);
    assert.equal(t[0], 0);
    assert.equal(t[t.length - 1], 29);
    assert.ok(t.length <= 5);
    assert.deepEqual(t, [...t].sort((a, b) => a - b));
});

test('tickIndices handles short and empty series', () => {
    assert.deepEqual(tickIndices(0, 5), []);
    assert.deepEqual(tickIndices(1, 5), [0]);
    assert.deepEqual(tickIndices(3, 5), [0, 1, 2]);
    assert.deepEqual(tickIndices(10, 1), [9]);
});

test('doughnutArcs starts at 12 o\'clock and sweeps proportionally to a full circle', () => {
    const [used, free] = doughnutArcs([25, 75]);
    assert.ok(Math.abs(used.start - -Math.PI / 2) < 1e-9);
    assert.ok(Math.abs(used.end - used.start - Math.PI / 2) < 1e-9);
    assert.ok(Math.abs(free.end - free.start - (3 * Math.PI) / 2) < 1e-9);
    assert.ok(Math.abs(free.end - (3 * Math.PI) / 2) < 1e-9);
});

test('doughnutArcs ignores negatives and survives an all-zero input', () => {
    assert.equal(doughnutArcs([-5, 10])[0].end, doughnutArcs([-5, 10])[0].start);
    const zero = doughnutArcs([0, 0]);
    assert.ok(zero.every((a) => a.end === a.start));
});

test('MiniChart exposes the Chart.js-compatible defaults the dashboard sets', () => {
    MiniChart.defaults.color = '#fff';
    MiniChart.defaults.font.family = 'Inter';
    assert.equal(MiniChart.defaults.color, '#fff');
    assert.equal(MiniChart.defaults.font.family, 'Inter');
});
