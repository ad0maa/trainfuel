# Mobile class mapping — raw → semantic

The Expo app currently hard-codes palette classes. After swapping in the new
`tailwind.config.js`, replace them with the semantic tokens so light/dark and
future re-theming come for free. Find/replace across `src/**`:

| Current (raw)                              | Replace with                          |
|--------------------------------------------|---------------------------------------|
| `bg-white dark:bg-black`                   | `bg-bg dark:bg-bg-dark`               |
| `bg-white dark:bg-black` (cards)           | `bg-surface dark:bg-surface-dark`     |
| `text-black dark:text-white`               | `text-ink dark:text-ink-dark`         |
| `text-gray-500` / `text-gray-400`         | `text-muted dark:text-muted-dark`     |
| `border-gray-200 dark:border-gray-800`     | `border-line dark:border-line-dark`   |
| `border-gray-300 dark:border-gray-700`     | `border-line dark:border-line-dark`   |
| `bg-blue-600` (primary action)             | `bg-accent dark:bg-accent-dark`       |
| `text-white` (on primary)                  | `text-onAccent dark:text-onAccent-dark`|
| `bg-gray-200 dark:bg-gray-800` (secondary) | `bg-surface2 dark:bg-surface2-dark`   |
| `text-green-600`                           | `text-success dark:text-success-dark` |
| `text-red-500` / `border-red-500`         | `text-danger dark:text-danger-dark`   |
| `text-amber-600` / `border-amber-400`     | `text-warning dark:text-warning-dark` |
| `rounded-lg`                               | `rounded-lg` (now = 16) or `rounded-md` (12) |

Keep the integration brand colors as-is (Strava orange `#fc4c02`, etc.) — those
are third-party marks, not theme tokens.

## Fonts
Add IBM Plex via `@expo-google-fonts/ibm-plex-sans` + `ibm-plex-mono`, load them
in `src/app/_layout.tsx` with `useFonts`, and register family names
`IBMPlexSans` / `IBMPlexMono` to match the `fontFamily` keys above.
