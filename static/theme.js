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

        html[data-theme="ios-glass"] {
            color-scheme: light;
            --bg-void: #dce8ff;
            --bg-main: #eef2ff;
            --bg-surface: rgba(255, 255, 255, 0.65);
            --bg-panel: rgba(255, 255, 255, 0.75);
            --bg-raised: rgba(255, 255, 255, 0.85);
            --bg-neu: rgba(255, 255, 255, 0.6);
            --glass-bg: rgba(255, 255, 255, 0.55);
            --glass-border: rgba(0, 0, 0, 0.08);
            --glass-shine: rgba(255, 255, 255, 0.7);
            --text-primary: #1c1c1e;
            --text-secondary: rgba(60, 60, 67, 0.85);
            --text-muted: rgba(60, 60, 67, 0.55);
            --border: rgba(0, 0, 0, 0.08);
            --neu-raise: 0 8px 32px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04);
            --neu-press: inset 0 2px 5px rgba(0,0,0,0.06);
            --neu-flat: 0 2px 5px rgba(0,0,0,0.05);
        }

        /* Override hardcoded dark elements in light themes */
        html[data-theme="vs"] textarea,
        html[data-theme="ios-glass"] textarea,
        html[data-theme="vs"] .pane-editor,
        html[data-theme="ios-glass"] .pane-editor,
        html[data-theme="vs"] .pane-output,
        html[data-theme="ios-glass"] .pane-output,
        html[data-theme="vs"] .sidebar,
        html[data-theme="ios-glass"] .sidebar,
        html[data-theme="vs"] .sidebar-header,
        html[data-theme="ios-glass"] .sidebar-header,
        html[data-theme="vs"] .panel-header,
        html[data-theme="ios-glass"] .panel-header,
        html[data-theme="vs"] .pane-header,
        html[data-theme="ios-glass"] .pane-header {
            background: var(--bg-surface) !important;
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

function applyThemeDOM(theme) {
    document.documentElement.removeAttribute('data-theme');
    
    let bg = '';
    let color = '';

    if (theme === 'ios-glass') {
        document.documentElement.setAttribute('data-theme', 'ios-glass');
        bg = '#dce8ff';
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
    } else {
        dynamicStyle.textContent = '';
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
