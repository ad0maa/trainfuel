# Handoff: TrainFuel — Cyan Steel design system

## Overview
A single visual design system for TrainFuel, to be applied first to the **web app**
(CedarJS, `trainfuel-cedar/web`) and then reused on **mobile** (Expo + NativeWind,
`trainfuel-mobile`). The direction is *Cyan Steel*: cool, clinical, data-first —
built for serious amateur athletes. Rings, numbers and charts are the hero; chrome
recedes. Full light + dark token sets are provided.

## About the design files
The files in `design_files/` are **design references created in HTML** — prototypes
showing the intended look, tokens and components. They are **not** production code to
copy verbatim (they use a small custom render runtime). Your task is to **recreate the
design in the existing codebases** using their established patterns:
- **Web:** CSS custom properties in `web/src/index.css` + the existing `.tf-*` class
  approach and Cell/component structure.
- **Mobile:** NativeWind theme tokens + `className` utilities.

Ready-to-use token files are in `tokens/` — start there, they are meant to be dropped in.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii and component styling are final.
Recreate pixel-accurately using each codebase's libraries. The HTML is the source of
truth for exact values; `tokens/tokens.json` is the machine-readable copy.

## What's in this package
```
tokens/
  tokens.json          Source-of-truth values (both themes, type, space, radius, shadow)
  tokens.css           Drop-in replacement for web/src/index.css :root (light + dark)
  tailwind.config.js   Drop-in replacement for trainfuel-mobile/tailwind.config.js
  MAPPING.md           Mobile: current raw Tailwind classes → new semantic tokens
design_files/
  TrainFuel Design System.dc.html      Full reference: foundations + every component
  TrainFuel Design Directions.dc.html  The 3 explored directions (context; 2c = chosen)
```

## Design tokens

### Color (light / dark)
| Role | Light | Dark |
|---|---|---|
| Background | `#f4f6f8` | `#08111a` |
| Surface (card) | `#ffffff` | `#101d29` |
| Surface-2 (inset/secondary) | `#eef2f6` | `#16283a` |
| Border / divider | `#e0e6ec` | `#1c2f3d` |
| Text | `#0c1826` | `#eaf2f8` |
| Text muted | `#5b6b7b` | `#7d94a6` |
| Accent | `#0891b2` | `#22b8d9` |
| Accent-2 (gradient/glow) | `#06b6d4` | `#38e0e0` |
| Accent-soft (tint bg) | `rgba(8,145,178,.10)` | `rgba(34,184,217,.16)` |
| On-accent (text on accent) | `#ffffff` | `#04141a` |
| Track (ring/bar unfilled) | `#e0e6ec` | `#1c2f3d` |
| Success | `#0f9d76` | `#34d399` |
| Warning | `#d98a1f` | `#f0b23e` |
| Danger | `#d1495b` | `#f76d7f` |

Primary buttons, ring fills and progress bars use the accent gradient
`linear-gradient(120deg, accent, accent-2)`.

### Typography
- **Sans:** IBM Plex Sans (all UI). **Mono:** IBM Plex Mono (stats, kcal, codes).
- **Always** use tabular numerals for numbers: `font-variant-numeric: tabular-nums`.
- Scale: Display 40/600/-3%, H1 30/600/-2%, H2 22/600, H3 18/600, Body 15/400/1.6,
  Small 13/400, Caption 11/600 uppercase +0.12em.

### Spacing (4px base)
4 / 8 / 12 / 16 / 24 / 32 / 48.

### Radius
sm 8 · md 12 · lg 16 · xl 22 · pill 999. Cards use lg(16)–xl(22); buttons md(10–12);
pills/badges 999.

### Elevation
- e1 `0 1px 2px rgba(0,0,0,.18)`
- e2 `0 6px 16px rgba(0,0,0,.24)`
- e3 `0 16px 36px rgba(0,0,0,.34)`
Use elevation sparingly — the system is border-first; shadows are for overlays/modals.

## Components (see design_files for exact markup)

### Buttons
- **Primary:** accent gradient bg, `on-accent` text, radius md, weight 600. Hover: `brightness(1.08)`.
- **Secondary:** `surface-2` bg, 1px `border`, `text` color. Hover: border → accent.
- **Ghost:** transparent, accent text. Hover: `accent-soft` bg.
- **Danger:** transparent, danger border+text; hover fills danger.
- **Disabled:** `surface-2` bg, muted text, opacity .55.
- Sizes: sm 6/14 · md 10/20 · lg 14/28. Icon button 40×40. Full-width for primary CTAs.

### Inputs & controls
Field: `bg` background, 1px `border`, radius md, 10/12 padding, `text` color.
Focus: border → accent + `0 0 0 3px accent-soft` ring. Error: danger border + danger
helper text + danger-tinted ring. Includes: text, number-with-unit, select, search
(leading ⌕), toggle/switch (accent when on), checkbox + range (accent-color: accent),
segmented control (active segment = surface + e1). Label 12/600, helper 11.5/muted.

### Badges & pills (radius 999)
- **Type:** RUN = accent-soft/accent; LIFT = warning-tint/warning; MEDICATION &
  SUPPLEMENT = surface-2/muted + border; PB = accent-2-tint/accent-2. 11/700 +0.05em.
- **Status:** Completed = success-tint + dot; Skipped = surface-2/muted + dot;
  Planned = accent-soft + dot. 12/600.
- **Source:** "via Strava/Hevy/HealthKit", Manual = surface-2/muted + border, 12/500.

### Cards
Surface bg, 1px border, radius lg(16), 16–18 padding. Variants shown: base, stat tile
(mono number + mini bar chart + delta), scheduled-item (type badge + time + title +
Tick/Skip), integration row (brand icon + name + status + Manage).

### Data visualization (hero)
- **Calorie ring:** conic-gradient from accent-2 → accent for the filled arc, `track`
  for the remainder; inner disc = surface; centered mono value + caption. Optional
  `0 0 30px accent-soft` glow in dark.
- **Macro bars:** 8px track, accent-gradient fill, tabular "x / y g" label.
- **Weekly volume:** column bars, filled columns use accent-gradient, rest `track`.
- **Streak dots:** 22px rounded squares, accent = done, track = pending.

## Applying to the web app (CedarJS)
1. Replace the `:root` block in `web/src/index.css` with `tokens/tokens.css`.
2. The existing `.tf-*` classes already reference `--tf-bg`, `--tf-surface`,
   `--tf-accent`, etc., so most screens re-theme automatically. Then upgrade
   components to the new patterns: gradient primary buttons, accent-gradient ring
   (`DailyEnergySummaryCell` — swap the flat `--tf-accent` conic for the
   accent→accent-2 gradient), macro bars, IBM Plex + tabular-nums, pill badges per
   the status/type/source spec, focus rings on inputs.
3. Add the fonts: `<link>` IBM Plex Sans + Mono (Google Fonts) in `web/index.html`,
   or install `@fontsource/ibm-plex-sans` + `@fontsource/ibm-plex-mono`.
4. Dark mode: set `<html data-theme="dark">` (or leave unset to follow the OS).
   Add a toggle that writes `data-theme` and persists to localStorage.

## Applying to mobile (Expo / NativeWind)
1. Replace `trainfuel-mobile/tailwind.config.js` with `tokens/tailwind.config.js`.
2. Follow `tokens/MAPPING.md` to swap raw classes (`bg-blue-600`, `bg-white
   dark:bg-black`, `text-gray-500`…) for semantic tokens (`bg-accent`, `bg-surface`,
   `text-muted`…). Keep `dark:` variants — the token config supplies dark values.
3. Load IBM Plex via `@expo-google-fonts/ibm-plex-sans` + `ibm-plex-mono` in
   `src/app/_layout.tsx`; family names `IBMPlexSans` / `IBMPlexMono`.
4. Build the calorie ring with `react-native-svg` (Circle + strokeDasharray, or a
   SVG conic approximation) since RN has no conic-gradient; use `expo-linear-gradient`
   for gradient fills on bars/buttons.

## Interactions & behavior
- Theme toggle: light ⇄ dark, persisted; default = follow OS.
- Button hover (web only): primary brightens, secondary border→accent, ghost gets
  accent-soft bg. Disabled: not-allowed, opacity .55.
- Input focus: accent border + 3px accent-soft ring. Validation error: danger border,
  ring and helper text.
- Ring/bars animate fill on data change (ease-out ~400ms) — optional, not required.

## Assets
No bespoke image assets. Icons: use the codebases' existing icon approach (the
prototype used simple text glyphs as placeholders — `+`, `⌕`). Integration marks
(Strava etc.) keep their official brand colors. Fonts: IBM Plex Sans + IBM Plex Mono
(Google Fonts / `@fontsource` / `@expo-google-fonts`).

## Files to reference in your repos
Web: `web/src/index.css`, `web/index.html`, `web/src/components/DailyEnergySummaryCell`,
`web/src/components/TodayScheduledItemsCell`, all `web/src/pages/*`.
Mobile: `tailwind.config.js`, `src/app/_layout.tsx`, `src/app/(app)/*`.
