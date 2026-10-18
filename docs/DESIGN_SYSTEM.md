# Aubrey Rankings — Design System Architecture

## Core Philosophy: Single Source of Truth

> **"Define once. Reuse everywhere. Extend when necessary. Never duplicate without a good reason."**

The Aubrey Rankings design system establishes a unified, accessible, and theme-resilient architecture across the entire application. Every component, page, and modal consumes centralized CSS tokens and shared primitive components rather than hardcoded hex colors, isolated slider scripts, or ad-hoc button styles.

---

## 1. Color Architecture & Semantic Tokens

All styling resolves through CSS custom properties defined in `src/app/globals.css` and mapped to Tailwind via CSS variables.

### Semantic Color Variables

| Token | Dark Mode Default | Light Mode Default | Semantic Purpose |
|---|---|---|---|
| `--background` | `#111514` | `#F7F6F0` | Default application canvas / page background. |
| `--surface` | `#18201C` | `#FFFFFF` | Primary surface for elevated containers, list items, and inputs. |
| `--surface-elevated`| `#202A25` | `#EBEAE3` | Dropdown menus, tooltips, hover states for interactive surfaces. |
| `--card` | `#141A17` | `#FFFFFF` | Content card background (rankings, items, modals). |
| `--card-foreground` | `#E4EDE5` | `#111514` | Content card text color. |
| `--foreground` | `#E4EDE5` | `#111514` | Primary high-contrast body & heading text. |
| `--muted-foreground`| `#8FA095` | `#5C6861` | Secondary captions, subheadings, labels, timestamps. |
| `--border` | `#28342D` | `#E1DFD6` | Standard structural borders and dividers. |
| `--ring` | Dynamic (Accent) | Dynamic (Accent) | Focus ring outline for accessible keyboard navigation. |
| `--primary` | `#89D5D5` (Teal) | `#1B6B6B` (Teal) | Primary brand accent for buttons, highlights, active toggles. |
| `--primary-text` | Dynamic (WCAG AA)| Dynamic (WCAG AA)| High-contrast accent text ensuring $\ge 4.5:1$ contrast against light & dark canvases. |

### The Dynamic `--primary-text` Contrast Engine

When users choose custom accent colors (Teal `#89D5D5`, Orange `#F97316`, Rose `#F43F5E`, Amber `#F59E0B`, Emerald `#10B981`, etc.), pale pastel accents provide high contrast on dark canvases (`#111514`), but fail WCAG AA contrast against light canvases (`#F7F6F0`).

The theme engine in `src/lib/theme.ts` implements `getAccessiblePrimaryText(accentHex, mode)`:
- In **Dark Mode**: Uses vibrant accent colors directly or slightly softened for optimal readability.
- In **Light Mode**: Automatically derives a deeper shade of the hue using relative luminance calculation ($L = 0.2126R + 0.7152G + 0.0722B$) until contrast ratio $\ge 4.5:1$ is mathematically guaranteed.
- **Result**: Primary buttons remain vibrant (`bg-primary text-primary-foreground`), while text links and subheadings use `text-primary-text` to stay effortlessly readable.

---

## 2. Universal Slider: `CinematicSlider`

File: `src/components/cinematic-slider.tsx`

All range inputs and slider controls across Aubrey Rankings MUST use `CinematicSlider`. Native `<input type="range">` elements are deprecated and forbidden.

### API Reference

```tsx
interface CinematicSliderProps {
  value: number | null;               // null indicates unrated/unset state
  onChange: (val: number) => void;
  min?: number;                       // default: 1
  max?: number;                       // default: 10
  step?: number;                      // default: 0.5
  disabled?: boolean;
  className?: string;
  allowUnset?: boolean;               // If true, clicking an active notch unsets to null
  size?: "sm" | "default" | "lg";     // "sm" for modals/settings, "default" for ratings
  showValue?: boolean;                // Display live value bubble/indicator
  valueSuffix?: string;               // e.g., "x" for weights (1.5x), pts for scores
}
```

### Usage Patterns

1. **Movie / Episode Rating Experience** (`allowUnset={true}`):
   ```tsx
   <CinematicSlider
     value={score}
     onChange={(val) => setScore(val)}
     min={1}
     max={10}
     step={0.5}
     allowUnset={true}
     size="default"
     showValue={true}
   />
   ```
   *Behavior*: If `score === null`, renders a neutral unfilled track with no thumb and displays "Not rated". Never silently defaults to 5.0. Clicking any notch assigns a rating; clicking the current rating unsets it back to `null`.

2. **Rubric Weight Calibration** (`allowUnset={false}`):
   ```tsx
   <CinematicSlider
     value={weight}
     onChange={(val) => setWeight(val)}
     min={0.5}
     max={2.0}
     step={0.1}
     allowUnset={false}
     size="sm"
     showValue={true}
     valueSuffix="x"
   />
   ```
   *Behavior*: Sliders cannot be unset to null. Live value displays formatted with multiplier suffix (`1.2x`).

---

## 3. Standardized UI Primitives

All UI components reside in `src/components/ui/`.

### Button (`src/components/ui/button.tsx`)
Built with Radix UI Slot / `class-variance-authority`.
- **Variants**:
  - `primary`: Filled accent background (`bg-primary text-primary-foreground hover:bg-primary-hover`).
  - `default`: Neutral surface button (`bg-surface text-foreground border border-border hover:bg-surface-elevated`).
  - `secondary`: Subdued background for utility actions.
  - `outline`: Bordered transparent button.
  - `ghost`: Transparent with hover background.
  - `destructive`: Warning/danger actions (`bg-red-600/90 hover:bg-red-600 text-white`).
  - `link`: Underlined inline text action.
- **Sizes**: `sm`, `default`, `lg`, `icon`, `icon-sm`.

### Badge (`src/components/ui/badge.tsx`)
- **Variants**:
  - `neutral`: Muted surface pill with subtle border.
  - `accent`: Primary brand pill with subtle opacity (`bg-primary/10 text-primary-text border-primary/20`).
  - `score`: High-visibility score indicator.
  - `success`: Emerald indicator for verified/completed state.
  - `warning`: Amber indicator for investigating/pending state.
  - `destructive`: Red indicator for critical issues or deletions.

### Card (`src/components/ui/card.tsx`)
Consolidated card primitives:
- `Card`: Semantic container with `bg-card border-border shadow-sm rounded-xl`.
- `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.

### Input (`src/components/ui/input.tsx`)
Accessible input element:
- Semantic borders (`border-border`), background (`bg-surface`), text (`text-foreground`), and focus rings (`focus-visible:border-primary focus-visible:ring-primary`).

### Dialog (`src/components/ui/dialog.tsx`)
Radix UI Dialog foundation:
- Accessible backdrop blur, keyboard ESC dismissal, focus trap, and semantic surface colors (`bg-card border-border`).

### Tabs (`src/components/ui/tabs.tsx`)
Radix UI Tabs foundation:
- Semantic tab triggers and panels respecting active accent colors.

---

## 4. Typography & Media Layout Standards

### Typography
- **Headings & Display**: `font-display` (Barlow Condensed), uppercase, tracked (`tracking-tight` or `tracking-wide`).
- **Body & Captions**: `font-sans` (Inter), readable line height (`leading-relaxed`), proper contrast against canvas.

### Media Aspect Ratios
- **Movie Posters**: Always preserve natural **2:3 aspect ratio** (`aspect-[2/3] object-cover`). Never distort or force into square containers.
- **TV Episode Stills**: Always preserve natural **16:9 aspect ratio** (`aspect-video object-cover`).
- **Logo ClearArts**: In collection headers, if `collection.clearLogoUrl` is present, render the clear logo image with an accessible `<h1 className="sr-only">{title}</h1>`. Never render both visible text `<h1>` and clear logo concurrently.

---

## 5. Rules for Contributors & Future Development

1. **No Hardcoded Hex Values**: Never write `bg-[#141a17]`, `text-[#f1f0e9]`, or `border-[#28342d]` in components. Always use semantic utilities (`bg-background`, `bg-card`, `bg-surface`, `text-foreground`, `text-muted-foreground`, `text-primary`, `border-border`).
2. **Always Support Light & Dark Modes**: Test any new view in both themes. Ensure headings, cards, and input fields remain readable.
3. **Always Use `CinematicSlider`**: Never implement `<input type="range">`.
4. **Use Shared Primitives**: If you need a button, modal, badge, or input, import it from `@/components/ui/*`.
