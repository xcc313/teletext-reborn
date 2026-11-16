# Teletext Authenticity Rules

These constraints are hard requirements. Every generated page, renderer output, and typeset result must satisfy them. The validation hook and validatePage() enforce them mechanically.

## Grid

- Exactly 40 columns × 25 rows per page
- Row 0: header — `P{number} {service} {HH:MM}`, plus a stale marker when content is stale
- Rows 1–23: content area
- Row 24: fastext row — four navigation links colored red, green, yellow, cyan (in that order)

## Colors

- Only the 8-color teletext palette: black, red, green, yellow, blue, magenta, cyan, white
- Default content: white or yellow text on black background
- No gradients, no opacity, no other hues anywhere in the UI

## Pages

- Page numbers are three digits, 100–899
- Reserved MVP pages: 100 index, 101 news, 302 weather, 888 about
- Unknown page numbers render a teletext-styled not-found page

## Text

- One printable glyph per cell; blocky monospace look
- Lines never exceed 40 columns: word-wrap first, truncate overlong single words
- Prefer uppercase for headers; keep body text plain and glanceable
- No modern UI chrome: no rounded corners, shadows, smooth animations, or sans-serif polish

## Data Freshness

- Stale content must be visibly marked in the header, never silently presented as live

