# Aubrey Rankings — Design System Architecture & Extensibility Guide

## Core Philosophy: Single Source of Truth

> **"Define once. Reuse everywhere. Extend effortlessly. Never duplicate without a good reason."**

The Aubrey Rankings design system establishes a unified, accessible, and deeply customizable architecture across the entire application. Every component, page, and modal consumes centralized CSS tokens and shared primitive components rather than hardcoded hex colors, isolated slider scripts, or ad-hoc button styles.

---

## 1. The 4-Tier Extensible Token Hierarchy

The design system is architected to support future personalization (such as user-defined themes, custom CSS injections, or editorial branding) with zero changes required to component source code.

```
┌────────────────────────────────────────────────────────┐
│  Tier 1: Global Primitive Scale                        │
│  --radius-base, --radius-sm, --radius-md, etc.         │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│  Tier 2: Global Fallback Defaults                      │
│  --radius: var(--radius-base)                          │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│  Tier 3: Component-Specific Semantic Tokens            │
│  --radius-card, --radius-dialog, --radius-button,      │
│  --radius-input, --radius-comment, --shadow-card,      │
│  --shadow-dialog, --border-card, --border-dialog       │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│  Tier 4: Explicit Local Overrides                      │
│  Rounded-full on circular avatars, badges, etc.        │
└────────────────────────────────────────────────────────┘
```

### Component Token Specifications

| Token | Dark Default | Light Default | Fallback / Inheritance | Target Component Utilities |
|---|---|---|---|---|
| `--radius-card` | `0.75rem` (`12px`) | `0.75rem` | `var(--radius-lg)` | `rounded-card` on cards, grids, and feeds |
| `--radius-dialog` | `1rem` (`16px`) | `1rem` | `var(--radius-xl)` | `rounded-dialog` on modal sheets & dialogs |
| `--radius-button` | `0.5rem` (`8px`) | `0.5rem` | `var(--radius-md)` | `rounded-button` on interactive buttons |
| `--radius-input` | `0.5rem` (`8px`) | `0.5rem` | `var(--radius-md)` | `rounded-input` on text inputs and selects |
| `--radius-comment` | `var(--radius-card)` | `var(--radius-card)` | `var(--radius-card)` | `rounded-comment` on discussion threads |
| `--radius-badge` | `0.375rem` (`6px`) | `0.375rem` | `var(--radius-sm)` | `rounded-badge` on chips and pills |
| `--shadow-card` | `0 1px 3px rgb(0 0 0 / 0.15)` | `0 1px 3px rgb(0 0 0 / 0.05)` | None | `shadow-card` on content cards |
| `--shadow-dialog`| `0 25px 50px -12px rgb(0 0 0 / 0.45)` | `0 25px 50px -12px rgb(0 0 0 / 0.15)` | None | `shadow-dialog` on modal overlays |
| `--border-card` | `var(--border)` | `var(--border)` | `var(--border)` | `border-border-card` on cards |
| `--border-dialog`| `var(--border)` | `var(--border)` | `var(--border)` | `border-border-dialog` on modals |
| `--border-input` | `var(--border)` | `var(--border)` | `var(--border)` | `border-border-input` on form inputs |

### Future Customization In Action

To transform Aubrey Rankings into a sharp, brutalist editorial aesthetic:
```css
:root {
  --radius-card: 0px;
  --radius-dialog: 0px;
  --radius-button: 0px;
  --radius-input: 0px;
  --shadow-card: none;
  --border-card: 2px solid var(--foreground);
}
```
Every card, button, dialog, and input across the site immediately reflects this without touching a single component file or breaking layout rules.

---

## 2. Color Architecture & Single Source of Truth

All color definitions are authoritatively declared in `src/lib/theme.ts` via `PALETTE.dark` and `PALETTE.light`, and synchronized into `src/app/globals.css`.

### Semantic Color Variables

| Token | Dark Mode Default | Light Mode Default | Semantic Purpose |
|---|---|---|---|
| `--background` | `#111514` | `#F7F6F0` | Default application canvas / page background. |
| `--surface` | `#18201C` | `#FFFFFF` | Primary surface for elevated containers, list items, and inputs. |
| `--surface-elevated`| `#202A25` | `#EBEAE3` | Dropdown menus, tooltips, hover states for interactive surfaces. |
| `--card` | `#141A17` | `#FFFFFF` | Content card background (rankings, items, modals). |
| `--card-foreground` | `#F1F0E9` | `#141A17` | Content card text color. |
| `--foreground` | `#F1F0E9` | `#141A17` | Primary high-contrast body & heading text. |
| `--muted-foreground`| `#8FA095` | `#66736A` | Secondary captions, subheadings, labels, timestamps. |
| `--border` | `#28342D` | `#D6D4CB` | Standard structural borders and dividers. |
| `--ring` | Dynamic (Accent) | Dynamic (Accent) | Focus ring outline for accessible keyboard navigation. |
| `--primary` | `#89D5D5` (Teal) | `#89D5D5` (Teal) | Primary brand accent for buttons, highlights, active toggles. |
| `--primary-text` | Dynamic (WCAG AA)| Dynamic (WCAG AA)| High-contrast accent text ensuring $\ge 4.5:1$ contrast against light & dark canvases. |

### The Dynamic Contrast Engine (`getAccessiblePrimaryText`)

When curators select extreme accents:
- **Pure Black (`#000000`)**: Dark mode automatically lifts `--primary-text` to `#F1F0E9` with an accessible hover shade (`#232323`), ensuring high contrast against `#111514`.
- **Pure White (`#FFFFFF`)**: Light mode automatically deepens text to `#141A17` to guarantee $\ge 4.5:1$ contrast against `#F7F6F0`.
- **Vibrant Accents (`#89D5D5`, `#F97316`, `#9D7FE6`)**: Linear-interpolation search dynamically adjusts luminance until WCAG AA 4.5:1 is achieved.

---

## 3. UI Primitives & Button Semantics

All UI primitives reside in `src/components/ui/`.

### Button (`src/components/ui/button.tsx`)
- **`default` (Neutral Surface)**: Used for standard cards, secondary actions, filters, and utility controls.
  - Class: `bg-surface text-foreground border border-border hover:bg-surface-elevated rounded-button`
- **`primary` (Brand Accent)**: Reserved for primary call-to-actions, confirmation triggers, and active highlights.
  - Class: `bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm rounded-button`
- **`secondary`**: Subdued background for utility actions.
- **`destructive`**: Warning/danger actions (`bg-red-600/90 hover:bg-red-600 text-white rounded-button`).
- **`outline` / `ghost` / `link`**: Standard utility variants.

### Card (`src/components/ui/card.tsx`)
- Consolidated card primitive:
  - Class: `rounded-card border-border-card bg-card text-card-foreground shadow-card`

### Dialog (`src/components/ui/dialog.tsx`)
- Radix UI Dialog primitive:
  - Class: `rounded-dialog border-border-dialog bg-card shadow-dialog`

### Input (`src/components/ui/input.tsx`)
- Semantic input primitive:
  - Class: `rounded-input border-border-input bg-surface text-foreground`

---

## 4. Universal Slider: `CinematicSlider`

File: `src/components/cinematic-slider.tsx`

All range inputs and slider controls across Aubrey Rankings MUST use `CinematicSlider`. Native `<input type="range">` elements are deprecated and forbidden.

- **Movie / Episode Rating**: `allowUnset={true}` (supports genuine unrated `null` state; clicking active rating resets to null).
- **Rubric Weight Calibration**: `allowUnset={false}` (clamps within 0–10 with `1.5x` format suffix).

---

## 5. Architectural Quality Standards

1. **No Hardcoded Hex Colors**: Never use `#141a17`, `#303b34`, or `#181f1b` in JSX. Use semantic classes (`bg-background`, `bg-card`, `bg-surface`, `bg-surface-elevated`, `text-foreground`, `text-muted-foreground`, `border-border`).
2. **Automated Verification**: Run `npx tsx scripts/check-design-system.ts` to detect any hardcoded color violations or token drift.
3. **Preserve Functional Formulas**: Never alter weighted average calculations, Better Auth flows, database migrations, or real user accounts.
