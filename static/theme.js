/**
 * DevSuite Global Theme Manager
 * -----------------------------------------
 * Handles loading and switching themes across all DevSuite tools.
 */

(function initTheme() {
    // Inject global theme override styles
    const style = document.createElement('style');
    style.textContent = `
        html[data-theme="ios-glass"] body::before,
        html[data-theme="high-contrast"] body::before,
        html[data-theme="vs"] body::before {
            display: none !important;
            animation: none !important;
            opacity: 0 !important;
        }

        html {
            color-scheme: dark;
        }

        html[data-theme="vs"] {
            color-scheme: light;
            --bg-void: #f8fafc;
            --bg-main: #f1f5f9;
            --bg-surface: #ffffff;
            --bg-panel: #ffffff;
            --bg-raised: #e2e8f0;
            --bg-neu: #f1f5f9;
            --glass-bg: rgba(255, 255, 255, 0.75);
            --glass-border: rgba(0, 0, 0, 0.1);
            --glass-shine: rgba(255, 255, 255, 0.6);
            --text-primary: #0f172a;
            --text-secondary: #475569;
            --text-muted: #64748b;
            --border: rgba(0, 0, 0, 0.1);
            --neu-raise: 4px 4px 10px rgba(0,0,0,0.06), -4px -4px 10px rgba(255,255,255,0.8);
            --neu-press: inset 3px 3px 6px rgba(0,0,0,0.05), inset -3px -3px 6px rgba(255,255,255,0.6);
            --neu-flat: 2px 2px 5px rgba(0,0,0,0.04), -2px -2px 5px rgba(255,255,255,0.7);
        }

        html[data-theme="high-contrast"] {
            color-scheme: dark;
            --bg-void: #000000;
            --bg-main: #000000;
            --bg-surface: #000000;
            --bg-panel: #000000;
            --bg-raised: #141414;
            --bg-neu: #000000;
            --glass-bg: rgba(0, 0, 0, 0.95);
            --glass-border: rgba(255, 255, 255, 0.4);
            --glass-shine: rgba(255, 255, 255, 0.1);
            --glass-blur: none;
            --text-primary: #ffffff;
            --text-secondary: #e0e0e0;
            --text-muted: #a0a0a0;
            --border: rgba(255, 255, 255, 0.4);
            --border-accent: rgba(255, 255, 255, 0.7);
            --neu-raise: none;
            --neu-press: none;
            --neu-flat: none;
            --shadow-glow: none;
        }

        html[data-theme="ios-glass"] {
            color-scheme: light;
            --bg-void: #c5d8ff;
            --bg-main: #d4e4ff;
            --bg-surface: rgba(255, 255, 255, 0.45);
            --bg-panel: rgba(255, 255, 255, 0.55);
            --bg-raised: rgba(255, 255, 255, 0.7);
            --bg-neu: rgba(255, 255, 255, 0.5);
            --glass-bg: rgba(255, 255, 255, 0.35);
            --glass-border: rgba(99, 130, 255, 0.18);
            --glass-shine: rgba(255, 255, 255, 0.6);
            --glass-blur: blur(24px) saturate(180%);
            --text-primary: #1c1c1e;
            --text-secondary: rgba(44, 44, 54, 0.85);
            --text-muted: rgba(60, 60, 67, 0.55);
            --border: rgba(99, 130, 255, 0.15);
            --neu-raise: 0 8px 32px rgba(80,100,220,0.12), 0 2px 6px rgba(80,100,220,0.06);
            --neu-press: inset 0 2px 5px rgba(80,100,220,0.1);
            --neu-flat: 0 2px 5px rgba(80,100,220,0.06);
        }

        /* Override hardcoded dark elements in light themes */
        html[data-theme="vs"] textarea,
        html[data-theme="ios-glass"] textarea { color: var(--text-primary) !important; }

        html[data-theme="vs"] .pane-editor,
        html[data-theme="vs"] .pane-output {
            background: #ffffff !important;
            border-color: rgba(0,0,0,0.08) !important;
        }
        html[data-theme="ios-glass"] .pane-editor,
        html[data-theme="ios-glass"] .pane-output {
            background: rgba(255,255,255,0.45) !important;
            backdrop-filter: blur(24px) saturate(180%) !important;
            -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
            border-color: rgba(99,130,255,0.18) !important;
        }
        html[data-theme="vs"] .sidebar,
        html[data-theme="ios-glass"] .sidebar,
        html[data-theme="vs"] .sidebar-header,
        html[data-theme="ios-glass"] .sidebar-header { background: var(--bg-surface) !important; }

        html[data-theme="vs"] .panel-header,
        html[data-theme="vs"] .pane-header {
            background: #f1f5f9 !important;
            border-bottom-color: rgba(0,0,0,0.08) !important;
        }
        html[data-theme="ios-glass"] .panel-header,
        html[data-theme="ios-glass"] .pane-header {
            background: rgba(255,255,255,0.4) !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
            border-bottom-color: rgba(99,130,255,0.15) !important;
        }
        html[data-theme="vs"] .tool-header {
            background: #ffffff !important;
            border-bottom-color: rgba(0,0,0,0.1) !important;
            box-shadow: 0 1px 8px rgba(0,0,0,0.08) !important;
        }
        html[data-theme="ios-glass"] .tool-header {
            background: rgba(255,255,255,0.5) !important;
            backdrop-filter: blur(30px) saturate(200%) !important;
            -webkit-backdrop-filter: blur(30px) saturate(200%) !important;
            border-bottom-color: rgba(99,130,255,0.2) !important;
            box-shadow: 0 1px 20px rgba(80,100,220,0.1) !important;
        }
        html[data-theme="vs"] .action-toolbar {
            background: #f8fafc !important;
            border-bottom-color: rgba(0,0,0,0.08) !important;
            box-shadow: none !important;
        }
        html[data-theme="ios-glass"] .action-toolbar {
            background: rgba(255,255,255,0.4) !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
            border-bottom-color: rgba(99,130,255,0.15) !important;
        }

        html[data-theme="vs"] textarea:focus,
        html[data-theme="ios-glass"] textarea:focus {
            background: var(--bg-panel) !important;
        }

        html[data-theme="vs"] .toast.error,
        html[data-theme="ios-glass"] .toast.error { color: #be123c !important; }
        
        html[data-theme="vs"] .toast.success,
        html[data-theme="ios-glass"] .toast.success { color: #047857 !important; }

        html[data-theme="vs"] .toast.warning,
        html[data-theme="ios-glass"] .toast.warning { color: #b45309 !important; }

        html[data-theme="vs"] .toast.info,
        html[data-theme="ios-glass"] .toast.info { color: #4338ca !important; }

        /* ── Crypto Suite: light theme fixes ── */
        html[data-theme="vs"] .crypto-tabs,
        html[data-theme="ios-glass"] .crypto-tabs {
            background: var(--bg-surface) !important;
            border-bottom-color: var(--glass-border) !important;
        }
        html[data-theme="vs"] .crypto-tab,
        html[data-theme="ios-glass"] .crypto-tab {
            color: var(--text-secondary) !important;
        }
        html[data-theme="vs"] .crypto-tab:hover,
        html[data-theme="ios-glass"] .crypto-tab:hover {
            color: var(--text-primary) !important;
        }
        html[data-theme="vs"] .crypto-tab.active,
        html[data-theme="ios-glass"] .crypto-tab.active {
            color: #7c3aed !important;
            border-bottom-color: #7c3aed !important;
        }
        html[data-theme="vs"] .cs-controls,
        html[data-theme="ios-glass"] .cs-controls {
            background: var(--bg-raised) !important;
        }
        html[data-theme="vs"] .cs-col-header,
        html[data-theme="ios-glass"] .cs-col-header {
            background: var(--bg-surface) !important;
            color: var(--text-muted) !important;
        }
        html[data-theme="vs"] .cs-textarea,
        html[data-theme="ios-glass"] .cs-textarea {
            background: var(--bg-panel) !important;
            color: var(--text-primary) !important;
        }
        html[data-theme="vs"] .cs-textarea:read-only,
        html[data-theme="ios-glass"] .cs-textarea:read-only {
            color: var(--text-secondary) !important;
        }
        html[data-theme="vs"] .hash-results,
        html[data-theme="ios-glass"] .hash-results {
            background: var(--bg-panel) !important;
        }
        html[data-theme="vs"] .hash-val,
        html[data-theme="ios-glass"] .hash-val {
            color: var(--text-primary) !important;
        }
        html[data-theme="vs"] .hash-algo,
        html[data-theme="ios-glass"] .hash-algo {
            color: #7c3aed !important;
        }
        html[data-theme="vs"] .key-textarea,
        html[data-theme="ios-glass"] .key-textarea {
            color: var(--text-secondary) !important;
        }
        html[data-theme="vs"] .cs-label,
        html[data-theme="ios-glass"] .cs-label {
            color: var(--text-muted) !important;
        }

        .global-theme-select {
            background: var(--bg-neu);
            color: var(--text-primary);
            border: 1px solid var(--glass-border);
            padding: 0.35rem 2rem 0.35rem 0.7rem;
            border-radius: 8px; /* var(--radius-xs) equivalent */
            font-family: 'Inter', -apple-system, sans-serif;
            font-size: 0.8rem;
            outline: none;
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            appearance: none;
            box-shadow: var(--neu-press);
            background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236366f1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
            background-repeat: no-repeat;
            background-position: right 0.5rem center;
            background-size: 0.85em;
            margin-right: 0.5rem;
        }

        select option {
            background-color: var(--bg-surface, #0f1326);
            color: var(--text-primary, #eef2ff);
            font-family: 'Inter', -apple-system, sans-serif;
            font-size: 0.8rem;
        }

        .global-theme-select:hover,
        .global-theme-select:focus {
            border-color: rgba(99, 102, 241, 0.5); /* var(--border-accent) */
            box-shadow: var(--neu-press), 0 0 0 2px rgba(99, 102, 241, 0.12);
        }
    `;
    document.head.appendChild(style);

    const savedTheme = localStorage.getItem('devsuite-theme') || 'vs-dark';
    applyThemeDOM(savedTheme);
})();

/**
 * Apply the selected visual theme to the document and update an injected dynamic style for body background and text color.
 *
 * Recognizes the following theme identifiers:
 * - "ios-glass": sets `data-theme="ios-glass"` and applies a light blue gradient background with dark text.
 * - "hc-black": sets `data-theme="high-contrast"` and applies a black background with white text.
 * - "vs": sets `data-theme="vs"` and applies a white background with dark text.
 * For unrecognized values the `data-theme` attribute is removed and any dynamic body styles injected by this function are cleared.
 * @param {string} theme - Theme identifier to apply ("ios-glass", "hc-black", "vs", or other to clear dynamic theme).
 */
function applyThemeDOM(theme) {
    document.documentElement.removeAttribute('data-theme');
    
    let bg = '';
    let color = '';

    if (theme === 'ios-glass') {
        document.documentElement.setAttribute('data-theme', 'ios-glass');
        bg = 'linear-gradient(135deg, #a8c0ff 0%, #c7d8ff 35%, #b8d0ff 65%, #a0b8f8 100%)';
        color = '#1c1c1e';
    } else if (theme === 'hc-black') {
        document.documentElement.setAttribute('data-theme', 'high-contrast');
        bg = '#000000';
        color = '#ffffff';
    } else if (theme === 'vs') {
        document.documentElement.setAttribute('data-theme', 'vs');
        bg = '#ffffff';
        color = '#111827';
    }

    let dynamicStyle = document.getElementById('devsuite-dynamic-theme');
    if (!dynamicStyle) {
        dynamicStyle = document.createElement('style');
        dynamicStyle.id = 'devsuite-dynamic-theme';
        document.head.appendChild(dynamicStyle);
    }
    
    if (bg && color) {
        dynamicStyle.textContent = `
            body {
                background: ${bg} !important;
                color: ${color} !important;
            }
        `;
        // Also set inline body styles so external selectors/scripts can read them
        if (document.body) {
            document.body.style.background = bg;
            document.body.style.color = color;
        }
    } else {
        dynamicStyle.textContent = '';
        // Clear inline body styles when reverting to default theme
        if (document.body) {
            document.body.style.background = '';
            document.body.style.color = '';
        }
    }
}

window.setDevSuiteTheme = function(theme) {
    localStorage.setItem('devsuite-theme', theme);
    applyThemeDOM(theme);

    // Update Monaco editor if it is loaded
    if (window.monaco && window.monaco.editor) {
        if (theme === 'ios-glass') {
            window.monaco.editor.setTheme('vs-dark');
        } else if (theme === 'hc-black') {
            window.monaco.editor.setTheme('hc-black');
        } else if (theme === 'vs') {
            window.monaco.editor.setTheme('vs');
        } else {
            window.monaco.editor.setTheme(theme);
        }
    }
    
    // Dispatch a custom event in case other tools need to react to theme changes
    window.dispatchEvent(new CustomEvent('devsuite-theme-changed', { detail: { theme } }));
};

/**
 * Attach change listeners to theme select elements and initialize their values from storage.
 *
 * Finds elements matching '.global-theme-select' and '#theme-select', sets each select's value
 * to the persisted theme from localStorage key 'devsuite-theme' (defaults to 'vs-dark'),
 * marks selects to avoid duplicate bindings, and registers a 'change' listener that calls
 * window.setDevSuiteTheme with the newly selected theme.
 */
function attachThemeListeners() {
    const themeSelects = document.querySelectorAll('.global-theme-select, #theme-select');
    const savedTheme = localStorage.getItem('devsuite-theme') || 'vs-dark';
    themeSelects.forEach(select => {
        if (!select.dataset.themeBound) {
            select.dataset.themeBound = 'true';
            select.value = savedTheme;
            select.addEventListener('change', (e) => {
                window.setDevSuiteTheme(e.target.value);
            });
        }
    });
}

attachThemeListeners();
document.addEventListener('DOMContentLoaded', attachThemeListeners);

/* ============================================================
   HOME/TOOLS PAGE — CSS variable maps for home.css tokens
   Injected by pages that use home.css (home.html, tools.html)
   Call: window.applyHomeCSSVars(theme)
   ============================================================ */
(function registerHomeThemes() {
    const HOME_THEMES = {
        // ── Default: Terminal Noir ──────────────────────────────
        'vs-dark': null, // null → clear all overrides, use :root defaults in home.css

        // ── Midnight Purple ─────────────────────────────────────
        'midnight': {
            '--void':         '#07071a',
            '--deep':         '#0c0c22',
            '--surface':      '#101038',
            '--surface-2':    '#14144a',
            '--surface-3':    '#1a1a58',
            '--text-primary': '#e8e6ff',
            '--text-secondary':'#9b95cc',
            '--text-muted':   '#4a4580',
            '--border':       'rgba(139,92,246,0.15)',
            '--border-bright':'rgba(139,92,246,0.28)',
            '--border-accent':'rgba(139,92,246,0.5)',
            '--electric':     '#8b5cf6',
            '--electric-glow':'rgba(139,92,246,0.22)',
            '--electric-dim': 'rgba(139,92,246,0.1)',
            '--lime':         '#4ade80',
            '--lime-glow':    'rgba(74,222,128,0.15)',
            '--amber':        '#f59e0b',
            '--violet':       '#a855f7',
            '--glow-blue':    '0 0 40px rgba(139,92,246,0.18), 0 0 80px rgba(139,92,246,0.08)',
        },

        // ── Ocean Blue ──────────────────────────────────────────
        'ocean': {
            '--void':         '#040d1a',
            '--deep':         '#071221',
            '--surface':      '#0d1b2e',
            '--surface-2':    '#102036',
            '--surface-3':    '#162840',
            '--text-primary': '#d8eeff',
            '--text-secondary':'#7fb0d8',
            '--text-muted':   '#3d6485',
            '--border':       'rgba(56,189,248,0.12)',
            '--border-bright':'rgba(56,189,248,0.22)',
            '--border-accent':'rgba(56,189,248,0.42)',
            '--electric':     '#38bdf8',
            '--electric-glow':'rgba(56,189,248,0.2)',
            '--electric-dim': 'rgba(56,189,248,0.08)',
            '--lime':         '#34d399',
            '--lime-glow':    'rgba(52,211,153,0.15)',
            '--amber':        '#fbbf24',
            '--violet':       '#a78bfa',
            '--glow-blue':    '0 0 40px rgba(56,189,248,0.18), 0 0 80px rgba(56,189,248,0.08)',
        },

        // ── Solarized Dark ──────────────────────────────────────
        'solarized': {
            '--void':         '#001e26',
            '--deep':         '#002b36',
            '--surface':      '#073642',
            '--surface-2':    '#0a3d4a',
            '--surface-3':    '#0d4a58',
            '--text-primary': '#fdf6e3',
            '--text-secondary':'#93a1a1',
            '--text-muted':   '#586e75',
            '--border':       'rgba(42,161,152,0.2)',
            '--border-bright':'rgba(42,161,152,0.35)',
            '--border-accent':'rgba(42,161,152,0.5)',
            '--electric':     '#268bd2',
            '--electric-glow':'rgba(38,139,210,0.2)',
            '--electric-dim': 'rgba(38,139,210,0.08)',
            '--lime':         '#859900',
            '--lime-glow':    'rgba(133,153,0,0.15)',
            '--amber':        '#b58900',
            '--violet':       '#6c71c4',
            '--glow-blue':    '0 0 40px rgba(38,139,210,0.18), 0 0 80px rgba(38,139,210,0.08)',
        },

        // ── iOS Glass (light) ───────────────────────────────────
        'ios-glass': {
            '--void':         '#c5d8ff',
            '--deep':         '#d4e4ff',
            '--surface':      'rgba(255,255,255,0.7)',
            '--surface-2':    'rgba(255,255,255,0.55)',
            '--surface-3':    'rgba(255,255,255,0.4)',
            '--text-primary': '#1c1c1e',
            '--text-secondary':'rgba(44,44,54,0.8)',
            '--text-muted':   'rgba(60,60,67,0.5)',
            '--border':       'rgba(99,130,255,0.2)',
            '--border-bright':'rgba(99,130,255,0.35)',
            '--border-accent':'rgba(99,130,255,0.5)',
            '--electric':     '#4f46e5',
            '--electric-glow':'rgba(79,70,229,0.2)',
            '--electric-dim': 'rgba(79,70,229,0.1)',
            '--lime':         '#16a34a',
            '--lime-glow':    'rgba(22,163,74,0.15)',
            '--amber':        '#d97706',
            '--violet':       '#7c3aed',
            '--glow-blue':    '0 0 40px rgba(79,70,229,0.14), 0 0 80px rgba(79,70,229,0.06)',
            '--glow-card':    '0 1px 0 rgba(255,255,255,0.3) inset, 0 -1px 0 rgba(0,0,0,0.1) inset',
        },

        // ── High Contrast ───────────────────────────────────────
        'hc-black': {
            '--void':         '#000000',
            '--deep':         '#000000',
            '--surface':      '#0a0a0a',
            '--surface-2':    '#111111',
            '--surface-3':    '#1a1a1a',
            '--text-primary': '#ffffff',
            '--text-secondary':'#e0e0e0',
            '--text-muted':   '#a0a0a0',
            '--border':       'rgba(255,255,255,0.35)',
            '--border-bright':'rgba(255,255,255,0.6)',
            '--border-accent':'rgba(255,255,255,0.85)',
            '--electric':     '#60a5fa',
            '--electric-glow':'rgba(96,165,250,0.3)',
            '--electric-dim': 'rgba(96,165,250,0.15)',
            '--lime':         '#86efac',
            '--lime-glow':    'rgba(134,239,172,0.2)',
            '--amber':        '#fde68a',
            '--violet':       '#c4b5fd',
            '--glow-blue':    'none',
            '--glow-card':    'none',
        },

        // ── VS Code Light ───────────────────────────────────────
        'vs': {
            '--void':          '#f3f4f8',
            '--deep':          '#eaecf2',
            '--surface':       '#ffffff',
            '--surface-2':     '#f8f9fb',
            '--surface-3':     '#eef0f5',
            '--text-primary':  '#0f1018',
            '--text-secondary':'#4b5280',
            '--text-muted':    '#8e94b0',
            '--border':        'rgba(0,0,0,0.09)',
            '--border-bright': 'rgba(0,0,0,0.16)',
            '--border-accent': 'rgba(37,99,235,0.4)',
            '--electric':      '#2563eb',
            '--electric-glow': 'rgba(37,99,235,0.2)',
            '--electric-dim':  'rgba(37,99,235,0.08)',
            '--lime':          '#16a34a',
            '--lime-glow':     'rgba(22,163,74,0.15)',
            '--amber':         '#d97706',
            '--violet':        '#7c3aed',
            '--glow-blue':     '0 0 0 transparent',
            '--glow-card':     '0 1px 4px rgba(0,0,0,0.07)',
        },
    };

    // All home.css tokens that themes can override
    const ALL_HOME_VARS = [
        '--void','--deep','--surface','--surface-2','--surface-3',
        '--text-primary','--text-secondary','--text-muted',
        '--border','--border-bright','--border-accent',
        '--electric','--electric-glow','--electric-dim',
        '--lime','--lime-glow','--amber','--violet',
        '--glow-blue','--glow-card',
    ];

    window.applyHomeCSSVars = function(theme) {
        const root = document.documentElement;
        // 1. Clear all previously set home vars
        ALL_HOME_VARS.forEach(v => root.style.removeProperty(v));
        // 2. Apply new theme vars
        const vars = HOME_THEMES[theme];
        if (vars) {
            Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
        }
        // 3. Clear any inline body styles theme.js may have set (CSS handles bg via --void)
        if (document.body) {
            document.body.style.background = '';
            document.body.style.color = '';
        }
    };
}());