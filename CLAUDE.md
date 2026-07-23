# CLAUDE.md

## Design system — Cyan Steel

TrainFuel's visual design system ("Cyan Steel") lives in [`docs/design-system/`](docs/design-system/README.md).
It's the source of truth for colors, typography, spacing, radii, elevation, and
component styling across both the web app and mobile app.

- `docs/design-system/README.md` — full spec: tokens, components, how to apply per platform.
- `docs/design-system/tokens/tokens.css` — drop-in CSS custom properties (already applied to `web/src/index.css`).
- `docs/design-system/tokens/tokens.json` — machine-readable source of truth for every value.
- `docs/design-system/design_files/*.dc.html` — high-fidelity HTML references (not production code — for visual reference only).

When building new UI: use the existing `--tf-*` CSS custom properties and `.tf-*`
classes in `web/src/index.css` rather than hardcoding colors/spacing. If a new
component pattern isn't covered there, check the design reference HTML/screenshots
first, then extend `index.css` following the same token-based approach.

The same token set (semantically renamed) drives `trainfuel-mobile` — see that
repo's `docs/design-system/` for the NativeWind mapping. Keep the two in sync if
the palette or type scale ever changes; `tokens.json` is the shared source.

## Local dev demo accounts

Two seeded accounts exist in the local dev DB (`trainfuel_dev`) for logging in
and testing without manual onboarding. **Local dev only — never use this
password pattern anywhere real.**

| Email | Password | Notes |
|---|---|---|
| `demo.runner@trainfuel.dev` | `TrainFuelDemo1!` | Fully populated: profile, 2 training blocks, a full week of scheduled items (mixed RUN/LIFT/MEDICATION/SUPPLEMENT, mixed completed/planned/skipped), today's food log, Strava connected (OK), Hevy connected (ERROR — expired key, for testing that state), one unmatched external activity. |
| `demo.lifter@trainfuel.dev` | `TrainFuelDemo1!` | Minimal: profile, one training block, two scheduled items today, a couple of food log entries, **no** integrations connected (tests the disconnected/empty state). |

Seeded by [`scripts/seed.ts`](scripts/seed.ts) — re-run any time with:

```bash
yarn cedar exec seed
```

Idempotent (skips a user if that email already exists), so it's also safe to
let `yarn cedar prisma migrate reset` re-run it automatically. Food log
entries need the AFCD food dataset seeded first (`yarn cedar exec seedAfcd`)
— if it's missing, that part is skipped with a warning rather than failing.

These are separate from your own real dev account(s) — the seed script never
touches existing users.
