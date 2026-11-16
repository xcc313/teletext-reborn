# Design Document

## Overview

Teletext Reborn is a single-page web app that renders live content as authentic 40×25 teletext pages. Data flows through connectors → content pipeline (summarize + typeset + validate) → page store → renderer. All application code is implemented by Kiro from tasks.md using a test-first (TDD) workflow, with property-based testing for core invariants.

## Architecture

```
[Open-Meteo weather API]   [News API / bundled demo feed]
            \                        /
          Data Connectors (src/connectors)
                      |
          Content Pipeline (src/pipeline)
          summarize -> typeset -> validate
                      |
               Page Store (src/store)
              last-good fallback, stale flag
                      |
       Teletext Renderer (src/renderer)  <—  Navigation (src/nav)
                      |
               Browser DOM grid (40×25)
```

## Components

- **Page model & validation** (`src/model`): `Page`, `Row`, `Cell` types; `validatePage()` enforcing all grid/palette/header/fastext invariants. Single source of truth used by both the pipeline gate and the PBT suite.
- **Typesetter** (`src/pipeline/typeset.ts`): pure function turning arbitrary text into ≤40-column lines (word wrap, long-word truncation, blank-line handling).
- **Connectors** (`src/connectors`): `weather.ts` (Open-Meteo, no API key) and `news.ts` (optional provider key, bundled demo fallback). Both accept an injectable `fetch` so tests exercise real code paths with recorded payloads; only the network boundary is stubbed.
- **Page store** (`src/store`): holds current pages, last-good copies, stale flags, and the refresh timer. Rejects invalid pages and logs violations.
- **Renderer** (`src/renderer`): draws a `Page` as a 40×25 DOM grid with the teletext palette and a blocky monospace look. DOM-first for testability; canvas upgrade is out of MVP scope.
- **Navigation** (`src/nav`): three-digit keypad buffer with partial-entry display, fastext link handling, not-found page template.

## Data Models

```ts
type Color = 'black'|'red'|'green'|'yellow'|'blue'|'magenta'|'cyan'|'white';
interface Cell { char: string; fg: Color; bg: Color }   // char: single printable glyph
type Row = Cell[];                                       // exactly 40 cells
interface FastextLink { label: string; target: number; color: 'red'|'green'|'yellow'|'cyan' }
interface Page {
  number: number;          // 100..899
  service: string;         // e.g. "TELETEXT REBORN"
  rows: Row[];             // exactly 25 rows; row 0 header, row 24 fastext
  fastext: [FastextLink, FastextLink, FastextLink, FastextLink];
  stale: boolean;
  generatedAt: string;     // ISO timestamp
}
```

Header convention (row 0): `P{number} {service} {HH:MM}` plus a stale marker when `stale` is true.

## Error Handling

- Connector fetch failure → keep last-good page, set `stale: true`, show marker in header.
- Validation failure → reject page, log row/column of violation, keep last-good page.
- Unknown page number → dedicated not-found page template, navigation remains live.
- No API keys configured → demo feed (news) + Open-Meteo (weather, keyless); app is fully judge-testable out of the box.

## Testing Strategy

- **TDD per task**: write the failing test first (Vitest), watch it fail for the right reason, implement minimally, refactor green.
- **Property-based testing** (fast-check): page invariants for arbitrary generated pages; typesetter line-length for arbitrary unicode input.
- **Connectors**: injected fetch returning recorded payloads; assert parsing, fallback, and stale behavior without live network in tests.

## Kiro Execution Notes

- Execute tasks from the Specs pane; independent tasks may run in parallel waves.
- Hooks in `.kiro/hooks/` auto-typecheck on TS saves and validate page JSON against steering rules.
- `.kiro/` must stay committed to the repository (hackathon requirement); never add it to `.gitignore`.

