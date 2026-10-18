---
name: design-system-change
description: Guide for updating semantic design tokens, component-level radius overrides, and color palettes without breaking extensibility.
---

# Design System Change Skill

Use this skill when modifying themes, colors, border radii, shadows, or component styling tokens.

## 1. Authoritative Token Declaration

The design system is dual-declared and must stay 100% in sync:
1. **TypeScript Constants**: `src/lib/theme.ts` (`PALETTE.dark`, `PALETTE.light`).
2. **CSS Custom Properties**: `src/app/globals.css` (`:root` and `.dark`).

When adding or altering a token, update both files simultaneously.

## 2. Component Radius Overrides

Components must reference component-specific semantic tokens rather than arbitrary Tailwind arbitrary classes (like `rounded-[14px]`):

- Cards & Media Tiles: `--radius-card` (Default: `12px` / `0.75rem`)
- Buttons & Badges: `--radius-button` (Default: `8px` / `0.5rem`)
- Modals & Dialogs: `--radius-dialog` (Default: `16px` / `1rem`)
- Form Inputs: `--radius-input` (Default: `8px` / `0.5rem`)
- Comment Bubbles: `--radius-comment` (Default: `8px` / `0.5rem`)

In JSX / Tailwind:
```tsx
// Use approved semantic classes:
className="rounded-card border border-border bg-card p-4 shadow-card"
className="rounded-button bg-primary text-primary-foreground px-4 py-2"
```

## 3. Contrast & Palette Rules

- Dynamic poster accent colors are computed through `src/lib/palette.ts`.
- Lightness is clamped and guaranteed $\ge 4.5:1$ contrast against base dark background (`#111514`).
- Radioactive or fluorescent neons are clamped to prevent garish visual artifacts.

## 4. Strict Interface Accent Token Rules

- **Zero Hardcoded Interface Accent Classes**: Never hardcode colors like `amber-*`, `yellow-*`, or `gold-*` for interactive elements such as buttons, active view toggles, badges, progress bars, or modal headers.
- **Required Semantic Tokens**: Always use Aubrey's theme tokens (`bg-primary`, `hover:bg-primary-hover`, `text-primary`, `text-primary-foreground`, `text-primary-text`, `bg-surface`, `bg-surface-elevated`, `border-border`, `bg-card`).
- **User Data vs. Interface Chrome**:
  - *User Data Colors*: User-customizable tier row colors (e.g. S tier `#EF4444`, A tier `#F97316`) are domain data stored in the database and applied dynamically via inline styles (`style={{ backgroundColor: tier.color }}`). These must remain untouched.
  - *Interface Chrome*: Any surrounding buttons, badges, banners, icons, modals, and toolbar controls MUST use semantic design tokens and adapt dynamically to the user's selected accent theme.

## 5. Verification Command

Run the automated design system audit script:

```bash
npx tsx scripts/check-design-system.ts
```

This verifies that:
- `globals.css` and `src/lib/theme.ts` palettes match exactly.
- All extensible tokens are properly defined.
- No legacy crypto/dark hex colors (`#141a17`, `#303b34`, `#102523`, etc.) exist in `src/app` or `src/components`.
- No forbidden hardcoded interface accent colors (`amber-*`, `yellow-*`, `gold-*`) exist in ranking or collection interface components.
