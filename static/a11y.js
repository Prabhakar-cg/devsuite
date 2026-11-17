/**
 * DevSuite Accessibility Foundation (feature 023, SPEC §9.12)
 * -----------------------------------------------------------
 * Injected into every page by deps.py::_serve_html() (never linked directly).
 *
 * Exposes:
 *   DevSuite.a11y.announce(message, politeness?)  — screen-reader announcement
 *   DevSuite.a11y.dialog.register(root, opts?)    — opt a custom dialog into the shared behavior
 *
 * Security notes: text is written with textContent only; input values are never
 * read, logged or stored; no network, no storage.
 */
(function () {
    'use strict';

    globalThis.DevSuite = globalThis.DevSuite || {};
    const a11y = (globalThis.DevSuite.a11y = globalThis.DevSuite.a11y || {});

    const FOCUSABLE = [
        'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
        'summary'
    ].join(',');

    /* ── Announcer ─────────────────────────────────────────────────────────── */
    const MAX_QUEUE = 5;
    const queue = [];
    let regions = null;
    let draining = false;

    function ensureRegions() {
        if (regions) return regions;
        const make = (role, live) => {
            const el = document.createElement('div');
            el.className = 'ds-sr-only';
            el.setAttribute('role', role);
            el.setAttribute('aria-live', live);
            el.setAttribute('aria-atomic', 'true');
            document.body.appendChild(el);
            return el;
        };
        regions = { polite: make('status', 'polite'), assertive: make('alert', 'assertive') };
        return regions;
    }

    function drain() {
        if (draining) return;
        draining = true;
        const step = () => {
            const item = queue.shift();
            if (!item) { draining = false; return; }
            const el = ensureRegions()[item.politeness];
            el.textContent = '';
            // Clear first, set on the next tick so repeated identical text re-announces.
            setTimeout(() => { el.textContent = item.message; setTimeout(step, 150); }, 30);
        };
        step();
    }

    a11y.announce = function announce(message, politeness) {
        if (!message || !document.body) return;
        const level = politeness === 'assertive' ? 'assertive' : 'polite';
        if (queue.length >= MAX_QUEUE) {
            // Keep errors; drop the oldest polite message first.
            const idx = queue.findIndex(q => q.politeness === 'polite');
            if (idx === -1 && level === 'polite') return;
            queue.splice(idx === -1 ? 0 : idx, 1);
        }
        queue.push({ message: String(message), politeness: level });
        drain();
    };

    /* ── Main landmark + skip-link target ──────────────────────────────────── */
    function wireMain() {
        const main = document.querySelector('main, [role="main"]');
        if (!main) return;
        if (!main.id) main.id = 'ds-main';
        const link = document.querySelector('.ds-skip-link');
        if (link && main.id !== 'ds-main') link.setAttribute('href', '#' + main.id);
        if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    }

    /* ── Toast container semantics ─────────────────────────────────────────── */
    function wireToastContainer() {
        const c = document.getElementById('toast-container');
        if (!c) return;
        if (!c.hasAttribute('role')) c.setAttribute('role', 'region');
        if (!c.hasAttribute('aria-label')) c.setAttribute('aria-label', 'Notifications');
        c.removeAttribute('aria-live'); // announcer handles speech; avoid double announcement
    }

    /* ── Shared dialog behavior ────────────────────────────────────────────── */
    const DIALOG_SELECTOR = 'dialog, [class*="modal-overlay"], .db-lock-overlay, #lock-overlay, #master-password-overlay, [data-ds-dialog]';
    const LOCK_SELECTOR = '.db-lock-overlay, #lock-overlay, #master-password-overlay, [data-ds-dialog="lock"]';
    const CLOSE_SELECTOR = '[data-close], .modal-close, .btn-cancel, [aria-label="Close"], [aria-label^="Close "]';
    const EXCLUDE_SELECTOR = '.cpal-dialog, [data-ds-no-trap]'; // Command Palette (022) manages its own focus

    const stack = [];      // LIFO of { root, opener }
    const known = new WeakMap();

    function isVisible(el) {
        if (el.tagName === 'DIALOG') return el.open;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        return el.getClientRects().length > 0;
    }

    function focusables(root) {
        return Array.from(root.querySelectorAll(FOCUSABLE)).filter(el =>
            !el.hasAttribute('disabled') && el.getClientRects().length > 0 &&
            getComputedStyle(el).visibility !== 'hidden');
    }

    function nameDialog(root) {
        if (root.hasAttribute('aria-label') || root.hasAttribute('aria-labelledby')) return;
        const heading = root.querySelector('h1, h2, h3, [class*="title"]');
        if (heading) {
            if (!heading.id) heading.id = 'ds-dlg-' + Math.random().toString(36).slice(2, 8);
            root.setAttribute('aria-labelledby', heading.id);
        } else {
            root.setAttribute('aria-label', 'Dialog');
        }
    }

    function onOpen(root, opts) {
        if (known.get(root)?.open) return;
        const state = { open: true, opener: document.activeElement, opts };
        known.set(root, state);
        // Overlay wrappers carry the semantics on the inner card when there is one.
        const target = root.tagName === 'DIALOG' ? root
            : (root.querySelector('.modal, .modal-box, .db-lock-card, .lock-card, .sftp-modal, .notes-modal, [class*="-modal"], [role="dialog"]') || root);
        if (target.tagName !== 'DIALOG') {
            target.setAttribute('role', 'dialog');
            target.setAttribute('aria-modal', 'true');
        }
        nameDialog(target);
        state.target = target;
        stack.push({ root, opener: state.opener });
        const items = focusables(target);
        const first = items[0];
        if (first) first.focus({ preventScroll: true });
        else { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
    }

    function onClose(root) {
        const state = known.get(root);
        if (!state?.open) return;
        state.open = false;
        const i = stack.findIndex(s => s.root === root);
        if (i !== -1) stack.splice(i, 1);
        const opener = state.opener;
        if (opener && document.contains(opener) && typeof opener.focus === 'function') {
            opener.focus({ preventScroll: true });
        } else {
            document.getElementById('ds-main')?.focus({ preventScroll: true });
        }
    }

    function sync(root, opts) {
        if (root.closest(EXCLUDE_SELECTOR)) return;
        if (isVisible(root)) onOpen(root, opts); else onClose(root);
    }

    a11y.dialog = {
        register(root, opts) {
            if (!root || root.dataset.dsRegistered) return;
            root.dataset.dsRegistered = '1';
            const o = Object.assign({ dismissible: !root.matches(LOCK_SELECTOR), closeSelector: CLOSE_SELECTOR }, opts);
            known.set(root, { open: false, opts: o });
            sync(root, o);
        }
    };

    function topDialog() { return stack.length ? stack[stack.length - 1] : null; }

    document.addEventListener('keydown', function (e) {
        const top = topDialog();
        if (!top) return;
        const state = known.get(top.root);
        const target = state?.target || top.root;
        if (e.key === 'Escape') {
            if (e.defaultPrevented) return;
            if (state?.opts?.dismissible === false) return;
            const btn = target.querySelector(state?.opts?.closeSelector || CLOSE_SELECTOR) ||
                        top.root.querySelector(CLOSE_SELECTOR);
            if (btn) { e.preventDefault(); btn.click(); }
            return;
        }
        if (e.key !== 'Tab') return;
        const items = focusables(target);
        if (!items.length) { e.preventDefault(); return; }
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        const active = document.activeElement;
        if (!target.contains(active)) { e.preventDefault(); firstEl.focus(); return; }
        if (e.shiftKey && active === firstEl) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && active === lastEl) { e.preventDefault(); firstEl.focus(); }
    }, true);

    // While a modal is open (e.g. a pre-unlock lock screen) the skip link targets the dialog.
    document.addEventListener('click', function (e) {
        const link = e.target.closest?.('.ds-skip-link');
        if (!link) return;
        const top = stack.length ? stack[stack.length - 1] : null;
        if (!top) return;
        const target = known.get(top.root)?.target || top.root;
        const first = target.querySelector(FOCUSABLE);
        e.preventDefault();
        (first || target).focus({ preventScroll: true });
    });

    function scan() {
        document.querySelectorAll(DIALOG_SELECTOR).forEach(el => {
            if (!el.dataset.dsRegistered) a11y.dialog.register(el);
            else sync(el, known.get(el)?.opts);
        });
    }

    /* ── Boot ──────────────────────────────────────────────────────────────── */
    function init() {
        wireMain();
        wireToastContainer();
        ensureRegions();
        scan();
        let scheduled = false;
        const mo = new MutationObserver(() => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => { scheduled = false; wireToastContainer(); scan(); });
        });
        mo.observe(document.body, {
            subtree: true, childList: true,
            attributes: true, attributeFilter: ['open', 'style', 'class', 'hidden']
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
