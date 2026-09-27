/**
 * DevSuite — Command Palette DOM controller (feature 022).
 *
 * Suite-wide Cmd/Ctrl+K navigation overlay. Built entirely at runtime (no markup
 * in any static/*.html file — see deps.py::_serve_html(), which injects this file
 * plus command-palette-data.js and command-palette.css into every page response).
 *
 * Uses the native <dialog> element (showModal()/close()) for the overlay shell,
 * which provides focus-trapping and Escape-to-close for free (FR-016), mirroring
 * the pattern already used in static/api-tester.html's modals (see
 * specs/022-command-palette/research.md §4 for the exact backdrop-click pattern
 * this file reuses).
 *
 * All destination names and the user's typed query are rendered via createElement
 * + textContent, never innerHTML (constitution Art. V, FR-012). The one exception
 * is each destination's icon markup, which is fixed, author-controlled SVG string
 * data from command-palette-data.js — never derived from user input — the same
 * "innerHTML of a static, code-owned SVG string" pattern static/vault.js already
 * uses for its own icon buttons.
 *
 * Requires zero authentication/session (FR-003): this module never calls any
 * /api/* endpoint and never checks auth-guard.js's session state, so it works
 * identically on a tool's pre-unlock lock screen.
 */
(function () {
    'use strict';

    const Data = globalThis.CommandPaletteData;
    if (!Data) { return; } // command-palette-data.js failed to load — fail silent, no palette rather than a broken one

    // Pages with their own pre-existing Ctrl/Cmd+K binding: the keyboard shortcut
    // defers to the page's own handler there (research.md §2); the trigger button
    // still opens the palette by click on every page, including these.
    const KEYBOARD_EXEMPT_ROUTES = ['/notes'];

    // ── State ──
    let dialog = null;
    let inputEl = null;
    let listEl = null;
    let filtered = Data.DESTINATIONS.slice();
    let highlightedIndex = 0;
    let isOpen = false;
    let lastFocused = null;

    // ── Helpers ──
    function isMac() {
        return /Mac|iPhone|iPad|iPod/.test((navigator.platform || navigator.userAgent || ''));
    }

    function svgFromMarkup(markup) {
        // markup is always one of command-palette-data.js's own authored SVG
        // strings — fixed, code-owned data, never user/query text.
        const holder = document.createElement('div');
        holder.innerHTML = markup; // NOSONAR — static, code-owned SVG icon markup only
        return holder.firstElementChild;
    }

    function clampHighlight() {
        if (filtered.length === 0) { highlightedIndex = 0; return; }
        if (highlightedIndex >= filtered.length) { highlightedIndex = filtered.length - 1; }
        if (highlightedIndex < 0) { highlightedIndex = 0; }
    }

    // ── Rendering ──
    function renderList() {
        listEl.replaceChildren();

        if (filtered.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'cpal-empty';
            empty.textContent = 'No matching tools.';
            listEl.appendChild(empty);
            return;
        }

        filtered.forEach(function (dest, i) {
            const row = document.createElement('li');
            row.className = 'cpal-row' + (i === highlightedIndex ? ' cpal-row-active' : '');
            row.id = 'cpal-row-' + i;
            row.setAttribute('role', 'option');
            row.setAttribute('aria-selected', i === highlightedIndex ? 'true' : 'false');

            const iconWrap = document.createElement('span');
            iconWrap.className = 'cpal-row-icon';
            const iconEl = svgFromMarkup(dest.icon);
            if (iconEl) { iconWrap.appendChild(iconEl); }
            row.appendChild(iconWrap);

            const nameEl = document.createElement('span');
            nameEl.className = 'cpal-row-name';
            nameEl.textContent = dest.name;
            row.appendChild(nameEl);

            if (dest.category !== 'nav') {
                const catEl = document.createElement('span');
                catEl.className = 'cpal-row-cat';
                catEl.textContent = dest.category;
                row.appendChild(catEl);
            }

            row.addEventListener('mousemove', function () {
                if (highlightedIndex !== i) { highlightedIndex = i; renderList(); }
            });
            row.addEventListener('click', function () { navigateTo(dest); });

            listEl.appendChild(row);
        });

        const activeEl = listEl.querySelector('.cpal-row-active');
        if (activeEl && activeEl.scrollIntoView) { activeEl.scrollIntoView({ block: 'nearest' }); }
    }

    function applyFilter() {
        filtered = Data.matchDestinations(inputEl.value, Data.DESTINATIONS);
        highlightedIndex = 0;
        renderList();
    }

    // ── Navigation ──
    function navigateTo(dest) {
        globalThis.location.href = dest.route;
    }

    // ── Open / close ──
    function openPalette() {
        if (isOpen) { return; } // FR-015 — never a second overlapping instance
        lastFocused = document.activeElement;
        inputEl.value = '';
        filtered = Data.DESTINATIONS.slice(); // FR-010 — always starts unfiltered
        highlightedIndex = 0;
        renderList();
        isOpen = true;
        dialog.showModal();
        inputEl.focus();
    }

    function closePalette() {
        if (!isOpen) { return; }
        isOpen = false;
        dialog.close();
        if (lastFocused && typeof lastFocused.focus === 'function') { lastFocused.focus(); }
        lastFocused = null;
    }

    // ── Build the DOM shell (once, on load) ──
    function buildShell() {
        dialog = document.createElement('dialog');
        dialog.className = 'cpal-dialog';
        dialog.setAttribute('aria-label', 'Command palette — jump to a DevSuite tool');

        const panel = document.createElement('div');
        panel.className = 'cpal-panel';

        const inputWrap = document.createElement('div');
        inputWrap.className = 'cpal-input-wrap';
        const searchIcon = svgFromMarkup(
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
        );
        if (searchIcon) { inputWrap.appendChild(searchIcon); }

        inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.className = 'cpal-input';
        inputEl.setAttribute('placeholder', 'Jump to a tool…');
        inputEl.setAttribute('aria-label', 'Search DevSuite tools');
        inputEl.setAttribute('autocomplete', 'off');
        inputEl.setAttribute('spellcheck', 'false');
        inputWrap.appendChild(inputEl);

        const hint = document.createElement('span');
        hint.className = 'cpal-esc-hint';
        hint.textContent = 'Esc';
        inputWrap.appendChild(hint);

        listEl = document.createElement('ul');
        listEl.className = 'cpal-list';
        listEl.setAttribute('role', 'listbox');

        panel.appendChild(inputWrap);
        panel.appendChild(listEl);
        dialog.appendChild(panel);
        document.body.appendChild(dialog);

        // Backdrop click closes (research.md §4 — the api-tester.js pattern:
        // a click lands directly on <dialog> itself, not on .cpal-panel content,
        // only when it hits the backdrop area a modal <dialog> covers).
        dialog.addEventListener('click', function (e) {
            if (e.target === dialog) { closePalette(); }
        });

        inputEl.addEventListener('input', applyFilter);

        dialog.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (filtered.length > 0) { highlightedIndex = (highlightedIndex + 1) % filtered.length; renderList(); }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (filtered.length > 0) { highlightedIndex = (highlightedIndex - 1 + filtered.length) % filtered.length; renderList(); }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filtered[highlightedIndex]) { navigateTo(filtered[highlightedIndex]); }
            } else if (e.key === 'Escape') {
                // <dialog> already closes natively on Escape; this also runs our
                // own cleanup (focus restore, isOpen flag) via the 'close' event.
            }
        });

        // Covers Escape (native dialog behavior) and any other path that calls
        // dialog.close() directly, so state/focus stay consistent either way.
        dialog.addEventListener('close', function () {
            isOpen = false;
            if (lastFocused && typeof lastFocused.focus === 'function') { lastFocused.focus(); }
            lastFocused = null;
        });
    }

    function buildTrigger() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cpal-trigger';
        btn.setAttribute('aria-label', 'Open command palette');
        btn.title = 'Jump to a tool (' + (isMac() ? 'Cmd' : 'Ctrl') + '+K)';

        const icon = svgFromMarkup(
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
        );
        if (icon) { btn.appendChild(icon); }

        const kbd = document.createElement('span');
        kbd.className = 'cpal-trigger-kbd';
        kbd.textContent = (isMac() ? '⌘' : 'Ctrl') + 'K';
        btn.appendChild(kbd);

        btn.addEventListener('click', openPalette);
        document.body.appendChild(btn);
    }

    // ── Global keyboard shortcut ──
    function onGlobalKeydown(e) {
        if (!((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K'))) { return; }
        if (KEYBOARD_EXEMPT_ROUTES.includes(globalThis.location.pathname)) { return; }
        e.preventDefault();
        if (isOpen) { return; } // FR-015
        openPalette();
    }

    function init() {
        buildShell();
        buildTrigger();
        document.addEventListener('keydown', onGlobalKeydown);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
