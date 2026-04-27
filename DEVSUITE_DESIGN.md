# DevSuite Design System
> Use this document with Claude Code to generate pixel-accurate DevSuite UI — components, screens, prototypes, or production code.

---

## Brand Overview

**DevSuite** is a locally-hosted, offline-first developer tools suite (FastAPI + vanilla JS/React).  
Tagline: *"The toolkit that stays on your machine."*  
13 tools: Diff, JSON/YAML Linter, Regex, Base64, Crypto, Secret Vault, SSH Terminal, API Tester, Cron Visualizer, URL/QR Studio, File Converter, DevDB Manager, SFTP Browser.  
GitHub: https://github.com/Prabhakar-cg/devsuite

---

## Design Philosophy

> Drawn from the Anthropic frontend-design skill — applied to DevSuite's specific context.

### Pre-Coding Design Thinking

Before writing any CSS or component, answer these four questions:

| Question | DevSuite Answer |
|----------|----------------|
| **Purpose** | A locally-hosted toolkit for developers. No cloud, no tracking, no friction. |
| **Tone** | Industrial-utilitarian dark (Terminal Noir) + surgical precision light (Apple Tool UI). Not pretty for its own sake — precise and purposeful. |
| **Constraints** | Offline-first (no CDN fonts in production), vanilla JS + FastAPI, WCAG AA minimum, monospace code must always be legible. |
| **Differentiation** | The one thing to remember: *it lives on your machine.* Every design choice should whisper that — local, fast, private, yours. |

**CRITICAL**: Commit to the aesthetic direction above before touching a line of CSS. Vague intentions produce generic output. Precision and intentionality — not decoration — are what make DevSuite's UI memorable.

---

### Aesthetic Execution Guidelines

#### Typography
- **Display/headlines**: JetBrains Mono — chosen for its terminal authority. This is intentional, not default.
- **Body/UI**: Inter — paired deliberately as the "human" counterpoint to the monospace mechanical voice.
- **Code/output**: Always JetBrains Mono. Never swap.
- Pair weights purposefully: 700 for structural anchors, 500 for labels, 400 for reading.
- Tight tracking (`-0.03em`) on display type; slightly open (`0.12em`) on all-caps eyebrows.

#### Color & Theme
- Every color is a token — never hardcode raw hex outside of the token definitions in this file.
- Dominant surfaces (`--void`, `--bg`) set the mood; accents (`--electric`, `--blue`) do the work.
- Resist adding new accent colors. DevSuite's palette is intentionally constrained: blue, lime, amber, violet — each with an assigned semantic role.
- Opacity variants (`rgba`) create hierarchy without adding hues.

#### Motion
- Animate for orientation, not decoration. A fade-up on card entry tells the user where focus is going.
- One well-orchestrated page-load sequence (staggered `animation-delay`) beats scattered micro-interactions everywhere.
- Hard rule: `step-end` cursor blink only — authentic terminal behavior, never `ease` on a cursor.
- Press states always use `scale(0.97–0.98)` — physical, tactile feedback.
- Keep all transitions at `0.2s cubic-bezier(0.4, 0, 0.2, 1)` — no slower, no faster.

#### Spatial Composition
- **Dark (marketing)**: Generous negative space. Let `--void` breathe. The grid background pattern provides structure without clutter.
- **Light (tools)**: Controlled density. Tool pages are workspaces — every pixel earns its place.
- Cards in the dark context float (`translateY(-2px)` on hover); light tool panels stay grounded.
- Use asymmetry and grid-breaking elements sparingly and intentionally — not as decoration.

#### Backgrounds & Visual Atmosphere
- Dark pages: the `grid-bg` pattern + `hero-glow` ambient orb create depth without images.
- Light tool pages: flat white `#ffffff` — the code and content *are* the texture.
- Section dividers: gradient line (`transparent → --electric → transparent`) instead of solid borders.
- Frosted glass headers (both dark and light) signal sticky navigation — the blur is functional, not aesthetic.

---

### What to Avoid

These are explicit anti-patterns for DevSuite UI — treat as hard rules:

- **No generic gradients**: Purple-on-white, teal-on-white, rainbow brand gradients — not DevSuite. Every gradient in this file has a specific assigned role.
- **No decorative icons or emoji in UI chrome**: Stroke-based SVG only, semantic purpose only.
- **No rounded-everything uniformity**: Radii are semantic — `pill` for interactive controls, `14px` for content cards, `7-8px` for inputs. Mixing randomly destroys hierarchy.
- **No centered-everything layouts**: DevSuite tool pages are left-aligned workspaces. Centered layouts are for hero sections only.
- **No animation for its own sake**: If you can't explain what the animation communicates, remove it.
- **No new font families**: The Inter + JetBrains Mono pairing is fixed. Adding a third font fractures the voice.
- **No unsemantic color use**: `--lime` means success/terminal output. `--amber` means vault/warning. `--electric` means primary action. Don't reassign.

---

### Complexity Must Match Vision

- **Terminal Noir sections** (dark, marketing): Rich — ambient glows, animated grid, staggered reveals, glow shadows on hover. Earn the drama.
- **Apple Tool UI sections** (light, functional): Restrained — precise spacing, subtle shadows, clean tab bars. Elegance comes from what you leave out.
- A maximalist hero and a minimal tool workspace can coexist in the same app because they serve different purposes. The dual-design vocabulary is intentional — don't collapse it into one style.

---

## Dual Design Vocabulary

DevSuite uses **two distinct visual systems** — choose based on context:

| Context | System | Background | Font |
|---------|--------|------------|------|
| Homepage, Tools Hub, marketing | **Terminal Noir** (dark) | `#05050a` | JetBrains Mono headlines + Inter body |
| Individual tool pages (Diff, Vault, SSH…) | **Apple Tool UI** (light) | `#ffffff / #f5f5f7` | Inter UI + JetBrains Mono code |

---

## Fonts

```css
/* Always import both */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');

--font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, monospace;
--font-body: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
```

---

## Color Tokens

### Terminal Noir — Dark (homepage/marketing)

```css
/* Surfaces */
--void:        #05050a;   /* page bg */
--deep:        #0a0b12;   /* alt sections */
--surface:     #0f1018;   /* cards */
--surface-2:   #13151f;   /* raised cards, panels */
--surface-3:   #1a1c28;   /* panel headers, hover */

/* Text */
--text-primary:   #f0f1f6;
--text-secondary: #9ea3b8;
--text-muted:     #5a5f7a;

/* Accents */
--electric:       #3b82f6;   /* primary blue */
--electric-hover: #2563eb;
--electric-glow:  rgba(59,130,246,0.20);
--electric-dim:   rgba(59,130,246,0.08);
--lime:           #4ade80;   /* success / terminal */
--lime-glow:      rgba(74,222,128,0.15);
--amber:          #f59e0b;   /* warning / vault */
--violet:         #8b5cf6;   /* secondary accent */

/* Borders */
--border:         rgba(255,255,255,0.07);
--border-bright:  rgba(255,255,255,0.14);
--border-accent:  rgba(59,130,246,0.35);

/* Shadows */
--glow-blue: 0 0 40px rgba(59,130,246,0.18), 0 0 80px rgba(59,130,246,0.08);
--glow-card: 0 1px 0 rgba(255,255,255,0.06) inset, 0 -1px 0 rgba(0,0,0,0.5) inset;
```

### Apple Tool UI — Light (tool pages)

```css
--bg:           #ffffff;
--bg-secondary: #f5f5f7;
--bg-tertiary:  #e8e8ed;

--text:         #1d1d1f;
--text-mid:     #515154;
--text-muted:   #86868b;

--blue:         #0071e3;
--blue-hover:   #0077ed;
--blue-subtle:  rgba(0,113,227,0.08);

--green:        #28cd41;
--green-mid:    #1a9c2a;
--green-subtle: rgba(40,205,65,0.08);

--red:          #ff3b30;
--red-mid:      #cc2016;
--red-subtle:   rgba(255,59,48,0.08);

--amber-light:  #ff9f0a;
--amber-mid:    #b45309;
--amber-subtle: rgba(255,159,10,0.08);

--border:       rgba(0,0,0,0.08);
--border-mid:   rgba(0,0,0,0.12);

--shadow-xs:    0 1px 3px rgba(0,0,0,0.05);
--shadow-sm:    0 2px 8px rgba(0,0,0,0.08);
--shadow-md:    0 4px 16px rgba(0,0,0,0.10);

/* Frosted glass — used on all tool headers */
--glass-bg:     rgba(255,255,255,0.85);
--glass-blur:   saturate(180%) blur(20px);
```

---

## Typography Scale

```css
/* Display / Hero */
.ds-display {
  font-family: var(--font-mono);
  font-size: clamp(2.4rem, 5.5vw, 4rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
  color: var(--text-primary);
}

/* Section headline */
.ds-h1 {
  font-family: var(--font-mono);
  font-size: clamp(1.8rem, 3.5vw, 2.6rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
}

/* Card / component title */
.ds-h3 {
  font-family: var(--font-mono);
  font-size: 0.88rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

/* Eyebrow label — always precedes a headline */
.ds-eyebrow {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--electric);
}
/* Add a short line before eyebrow: */
.ds-eyebrow::before {
  content: '';
  display: inline-block;
  width: 16px; height: 1px;
  background: var(--electric);
  opacity: 0.6;
  margin-right: 8px;
  vertical-align: middle;
}

/* Body */
.ds-body { font-family: var(--font-body); font-size: 0.95rem; line-height: 1.75; color: var(--text-secondary); }
.ds-body-sm { font-family: var(--font-body); font-size: 0.82rem; line-height: 1.7; color: var(--text-secondary); }

/* Code / terminal */
.ds-code { font-family: var(--font-mono); font-size: 0.82rem; line-height: 1.65; }

/* UI panel label (light tool pages) */
.ds-panel-label {
  font-family: var(--font-body);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}
```

---

## Spacing & Radii

```css
--radius-xl:   16px;    /* modals, lock cards */
--radius:      14px;    /* standard cards (light) */
--radius-sm:   10-12px; /* small cards */
--radius-xs:   7-8px;   /* inputs, small buttons */
--radius-pill: 980px;   /* CTA buttons, badges, chips */

/* Standard spacing rhythm */
4px   gap-1   icon spacing
8px   gap-2   tight inline
12px  gap-3   button padding
16px  gap-4   card padding inner
20-24px       section inner padding
32px          container edge padding
60-80px       section vertical padding
1140px        max content width
```

---

## Motion

```css
--transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

/* Entry animations */
@keyframes fade-up {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fade-left {
  from { opacity: 0; transform: translateX(30px); }
  to   { opacity: 1; transform: translateX(0); }
}

/* Hover states */
/* Dark cards:    translateY(-2px) + border-bright */
/* About cards:   translateX(4px) */
/* CTA buttons:   translateY(-1px) + stronger glow */
/* Press/active:  scale(0.97-0.98) */
/* Cursor blink:  step-end (hard, authentic terminal) */
```

---

## Components

### Dark Header (frosted glass — marketing)

```html
<header style="
  background: rgba(5,5,10,0.85);
  backdrop-filter: saturate(180%) blur(24px);
  border-bottom: 1px solid rgba(255,255,255,0.07);
  height: 56px;
  position: sticky; top: 0; z-index: 100;
">
  <!-- Logo mark: 32px, background #3b82f6, radius 8px, box-shadow: 0 0 16px rgba(59,130,246,0.4) -->
  <!-- Logo name: JetBrains Mono 14px 600, color #f0f1f6 -->
  <!-- Version pill: JetBrains Mono 9px, background #1a1c28, border rgba(255,255,255,0.07), radius 3px -->
  <!-- CTA: background #3b82f6, radius 6px, JetBrains Mono 11px 500, box-shadow: 0 0 20px rgba(59,130,246,0.3) -->
</header>
```

### Light Tool Header (frosted glass — tool pages)

```html
<header style="
  background: rgba(255,255,255,0.85);
  backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid rgba(0,0,0,0.08);
  height: 52px;
  position: sticky; top: 0; z-index: 100;
">
  <!-- Back link: pill shape, radius 980px, border rgba(0,0,0,0.12), Inter 12px 500 -->
  <!-- Tool icon: 30px, gradient bg, radius 8px, ::after shine on top-left -->
  <!-- Tool name: Inter 14px 700, #1d1d1f, accent word in --blue -->
  <!-- Version badge: JetBrains Mono 9px 600, uppercase, pill shape -->
</header>
```

### Logo Mark

```html
<!-- The <> slash motif -->
<div style="width:32px;height:32px;background:#3b82f6;border-radius:8px;
  box-shadow:0 0 16px rgba(59,130,246,0.4);
  display:flex;align-items:center;justify-content:center;">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="16 18 22 12 16 6"/>
    <polyline points="8 6 2 12 8 18"/>
  </svg>
</div>
```

### Tool Icon Container

```html
<!-- Gradient icon container — one per tool -->
<div style="
  width: 44px; height: 44px;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1, #3b82f6); /* per-tool gradient */
  display: flex; align-items: center; justify-content: center;
  position: relative; overflow: hidden;
">
  <!-- Shine layer (top-left highlight) -->
  <div style="position:absolute;top:0;left:0;right:50%;height:50%;
    background:rgba(255,255,255,0.15);border-radius:10px 10px 0 0;"></div>
  <!-- SVG icon: 20px, color white, stroke-based -->
</div>
```

**Tool gradient map:**
| Tool | Gradient |
|------|----------|
| Text Diff | `linear-gradient(135deg,#6366f1,#3b82f6)` |
| JSON Linter | `linear-gradient(135deg,#0c4a6e,#0ea5e9)` |
| YAML Linter | `linear-gradient(135deg,#065f46,#059669)` |
| Regex Tester | `linear-gradient(135deg,#5b21b6,#7c3aed)` |
| Base64 | `linear-gradient(135deg,#1e40af,#3b82f6)` |
| File Converter | `linear-gradient(135deg,#0f766e,#14b8a6)` |
| Crypto Suite | `linear-gradient(135deg,#b45309,#f59e0b)` |
| Secret Vault | `linear-gradient(135deg,#78350f,#b45309)` |
| DevDB Manager | `linear-gradient(135deg,#312e81,#4f46e5)` |
| API Tester | `linear-gradient(135deg,#7c3aed,#a855f7)` |
| SSH Terminal | `linear-gradient(135deg,#0c4a6e,0369a1)` |
| URL & QR Studio | `linear-gradient(135deg,#5b21b6,#8b5cf6)` |
| Cron Visualizer | `linear-gradient(135deg,#92400e,#d97706)` |

### Buttons — Dark Context

```css
/* Primary CTA */
.btn-primary-dark {
  display: inline-flex; align-items: center; gap: 8px;
  background: #3b82f6; color: #fff; border: none;
  padding: 10px 22px; border-radius: 7px;
  font-family: var(--font-mono); font-size: 13px; font-weight: 500;
  cursor: pointer; letter-spacing: 0.01em;
  box-shadow: 0 0 24px rgba(59,130,246,0.3);
  transition: var(--transition);
}
.btn-primary-dark:hover {
  background: #2563eb;
  box-shadow: 0 0 32px rgba(59,130,246,0.5);
  transform: translateY(-1px);
}

/* Outline */
.btn-outline-dark {
  background: transparent; color: #9ea3b8;
  border: 1px solid rgba(255,255,255,0.14);
  padding: 10px 22px; border-radius: 7px;
  font-family: var(--font-mono); font-size: 13px;
}
.btn-outline-dark:hover {
  color: #f0f1f6;
  border-color: rgba(59,130,246,0.35);
  background: rgba(59,130,246,0.08);
  transform: translateY(-1px);
}

/* Ghost */
.btn-ghost-dark {
  background: rgba(255,255,255,0.06); color: #9ea3b8;
  border: 1px solid rgba(255,255,255,0.07);
  padding: 7px 14px; border-radius: 5px;
  font-family: var(--font-mono); font-size: 11px;
}
```

### Buttons — Light Tool Context

```css
/* Primary pill */
.btn-primary-light {
  background: #0071e3; color: #fff; border: none;
  padding: 9px 26px; border-radius: 980px;
  font-family: var(--font-body); font-size: 14px; font-weight: 600;
  cursor: pointer; transition: var(--transition);
}
.btn-primary-light:hover { background: #0077ed; transform: scale(1.01); }
.btn-primary-light:active { transform: scale(0.98); }

/* Ghost pill */
.btn-ghost-light {
  background: #fff; color: #515154;
  border: 1px solid rgba(0,0,0,0.12);
  padding: 5px 13px; border-radius: 980px;
  font-family: var(--font-body); font-size: 12px; font-weight: 500;
}
.btn-ghost-light:hover { color: #1d1d1f; border-color: rgba(0,0,0,0.22); background: #f5f5f7; }
.btn-ghost-light.active { background: #1d1d1f; color: #fff; border-color: #1d1d1f; }
```

### Tab Bar (light)

```css
.tabs-bar {
  display: flex; padding: 0 20px;
  background: #fff;
  border-bottom: 1px solid rgba(0,0,0,0.08);
}
.tab-btn {
  background: transparent; border: none;
  border-bottom: 2px solid transparent;
  color: #86868b; padding: 10px 16px;
  font-family: var(--font-body); font-size: 12px; font-weight: 500;
  cursor: pointer; transition: var(--transition);
}
.tab-btn.active { color: #0071e3; border-bottom-color: #0071e3; font-weight: 600; }
```

### Cards — Dark

```css
.card-dark {
  background: #13151f;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 1px 0 rgba(255,255,255,0.06) inset,
              0 -1px 0 rgba(0,0,0,0.5) inset;
  transition: var(--transition);
}
.card-dark:hover {
  border-color: rgba(255,255,255,0.14);
  transform: translateY(-2px);
}
```

### Cards — Light

```css
.card-light {
  background: #fff;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  transition: var(--transition);
}
.card-light:hover {
  border-color: #0071e3;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  transform: translateY(-1px);
}
```

### Badges & Chips

```css
/* Status pill with animated dot */
.status-pill {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--font-mono); font-size: 10px; font-weight: 600;
  letter-spacing: 0.05em; text-transform: uppercase;
  padding: 4px 10px; border-radius: 980px; border: 1px solid;
}
.status-live    { color: #4ade80; background: rgba(74,222,128,0.08);  border-color: rgba(74,222,128,0.25); }
.status-beta    { color: #fb923c; background: rgba(251,146,60,0.08);  border-color: rgba(251,146,60,0.25); }
.status-error   { color: #f87171; background: rgba(248,113,113,0.08); border-color: rgba(248,113,113,0.25); }

.pulse-dot {
  width: 5px; height: 5px; border-radius: 50%;
  animation: pulse-dot 2s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%,100% { opacity:1; transform:scale(1); }
  50% { opacity:0.7; transform:scale(0.85); }
}

/* HTTP method badges */
.method { font-family: var(--font-mono); font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 5px; letter-spacing: 0.06em; }
.m-get    { background: rgba(74,222,128,0.12);  color: #4ade80; }
.m-post   { background: rgba(59,130,246,0.12);  color: #60a5fa; }
.m-put    { background: rgba(245,158,11,0.12);  color: #fbbf24; }
.m-delete { background: rgba(248,113,113,0.12); color: #f87171; }
.m-patch  { background: rgba(139,92,246,0.12);  color: #a78bfa; }

/* Diff stat chips */
.diff-add { color: #4ade80; background: rgba(74,222,128,0.08); border: 1px solid rgba(74,222,128,0.2); padding: 3px 10px; border-radius: 980px; font-family: var(--font-mono); font-size: 11px; font-weight: 700; }
.diff-del { color: #f87171; background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2); }

/* Keyboard shortcut keycaps */
.kbd {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 22px; height: 20px; padding: 0 5px;
  background: #13151f;
  border: 1px solid rgba(255,255,255,0.12);
  border-bottom-width: 2px;
  border-radius: 5px;
  font-family: var(--font-mono); font-size: 10px; color: #9ea3b8;
}

/* Version tags */
.ver-stable { background: rgba(74,222,128,0.1); color: #4ade80; border: 1px solid rgba(74,222,128,0.2); border-radius: 5px; padding: 3px 8px; font-family: var(--font-mono); font-size: 10px; font-weight: 700; }
.ver-canary { background: rgba(139,92,246,0.1); color: #a78bfa; border: 1px solid rgba(139,92,246,0.2); }
```

### Form Inputs (light)

```css
input, textarea, select {
  background: #fff; color: #1d1d1f;
  border: 1px solid rgba(0,0,0,0.12);
  padding: 8px 12px; border-radius: 10px;
  font-family: var(--font-mono); font-size: 12px;
  outline: none; transition: var(--transition);
}
input:focus, textarea:focus {
  border-color: rgba(0,0,0,0.22);
  box-shadow: 0 0 0 3px rgba(0,113,227,0.08);
}
```

### Terminal Window

```html
<div style="
  background: #13151f;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 12px; overflow: hidden;
  box-shadow: 0 24px 80px rgba(0,0,0,0.6),
              0 0 40px rgba(59,130,246,0.12);
">
  <!-- Title bar -->
  <div style="background:#1a1c28;border-bottom:1px solid rgba(255,255,255,0.07);padding:10px 16px;display:flex;align-items:center;gap:6px;">
    <!-- Traffic lights: #ff5f56, #ffbd2e, #27c93f — 10px circles, gap 6px -->
    <!-- Title: JetBrains Mono 11px, color #5a5f7a -->
  </div>
  <!-- Body: JetBrains Mono 12px, line-height 1.9 -->
  <!-- Prompt:  color #4ade80 -->
  <!-- Command: color #f0f1f6 -->
  <!-- Flag:    color #3b82f6 -->
  <!-- Output:  color #9ea3b8 -->
  <!-- Success: color #4ade80 -->
  <!-- Cursor:  8x14px, background #4ade80, animation step-end blink -->
</div>
```

### Grid Background Pattern

```css
/* Hero section grid — use with radial mask */
.grid-bg {
  background-image:
    linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 80% 80% at 50% 40%, black 20%, transparent 80%);
}

/* Ambient hero glow */
.hero-glow {
  position: absolute;
  width: 800px; height: 600px;
  background: radial-gradient(ellipse,
    rgba(59,130,246,0.12) 0%,
    rgba(139,92,246,0.06) 40%,
    transparent 70%);
  animation: ambient-shift 12s ease-in-out infinite alternate;
}
@keyframes ambient-shift {
  0%   { transform: translate(-50%,-60%) scale(1); }
  100% { transform: translate(-50%,-55%) scale(1.15); }
}

/* Section top border gradient */
.section-divider-top::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(59,130,246,0.35), transparent);
}
```

---

## 6 Runtime Themes

Override the Terminal Noir CSS vars to switch themes:

| Theme | `--electric` | `--void` | Vibe |
|-------|-------------|---------|------|
| **Noir** (default) | `#3b82f6` | `#05050a` | Industrial dark |
| **Midnight** | `#8b5cf6` | `#07071a` | Purple dark |
| **Ocean** | `#38bdf8` | `#040d1a` | Cyan dark |
| **Solarized** | `#268bd2` | `#002b36` | Ethan Schoonover |
| **Light** | `#2563eb` | `#f3f4f8` | Clean white |
| **Hi-Contrast** | `#60a5fa` | `#000000` | WCAG AAA |

---

## Content & Copy Rules

- **Tone**: Direct, technical, developer-to-developer. No fluff. No exclamation marks.
- **Privacy-first language**: "Nothing leaves your machine", "Zero cloud", "100% local" — use these phrases.
- **Sentence case** for UI labels (`Add secret`, not `Add Secret`)
- **ALL CAPS** for eyebrow/category labels
- **Title Case** for tool names (`Secret Vault`, `Cron Visualizer`)
- **Monospace** for paths, versions, code snippets always
- **No emoji in UI** — only in terminal demo output
- **Stat pattern**: bare number + short lowercase label (`13 Tools`, `0 Cloud calls`)
- **Error messages**: always actionable — What happened + Why + How to fix

---

## Iconography Rules

- All icons: **stroke-based SVG**, `stroke-width: 1.8–2.5`, `stroke-linecap: round`, `stroke-linejoin: round`
- Displayed at **16–20px** inside 24×24 viewBox
- Color: `currentColor` (inherited) or explicit accent
- Inside tool icon containers: always **white**, 20px
- **No icon fonts**, no PNG icons, no emoji as icons
- Use Lucide Icons or Heroicons (outline) as the matching style if generating new icons

---

## Secret Vault — Special Rules

The Vault tool has **amber branding** instead of the default blue:

```css
/* Vault-specific overrides */
--vault-accent:    #b45309;
--vault-hover:     #f59e0b;
--vault-subtle:    rgba(255,159,10,0.08);
--vault-border:    rgba(255,159,10,0.2);
--vault-gradient:  linear-gradient(135deg, #78350f, #92400e);

/* Secret category colors */
--clr-api:      #0ea5e9;
--clr-ssh:      #10b981;
--clr-token:    #6366f1;
--clr-password: #a855f7;
--clr-note:     #f59e0b;
```

---

## Scrollbar Style

```css
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
/* Light context: */
::-webkit-scrollbar-thumb { background: #c7c7cc; }
```

---

## Quick Reference — What to Use Where

| Situation | Font | Background | Primary button |
|-----------|------|------------|----------------|
| Marketing hero headline | JetBrains Mono 700 | `#05050a` | `#3b82f6` radius-7px glow |
| Tool page header | Inter 700 | `rgba(255,255,255,0.85)` blur | `#0071e3` radius-pill |
| Code/terminal block | JetBrains Mono 400 | `#13151f` | — |
| Modal / lock screen | Inter | `rgba(255,255,255,0.97)` | gradient `#78350f→#92400e` (vault) |
| Diff panel | JetBrains Mono 12px | `#ffffff` | `#0071e3` |
| SSH terminal | JetBrains Mono 12px | `#05050a` | — |
| Error state | Inter | red-subtle bg | — |
| Success/connected | — | lime dot pulse | — |
