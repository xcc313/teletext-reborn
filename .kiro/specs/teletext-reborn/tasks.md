# Implementation Plan

Execute these tasks in Kiro (Specs pane). Test-first rule for every implementation task: write the failing test, watch it fail for the expected reason, then write minimal code to pass, then refactor. Do not skip the RED step.

- [x] 1. Scaffold the project
  - Vite + TypeScript (strict mode), Vitest, fast-check; npm scripts: dev / build / test / typecheck
  - Verify `npm test` and `npm run typecheck` run cleanly
  - _Requirements: 6.1, 6.2_

- [x] 2. Page model and validation
  - [x] 2.1 Write failing tests for `validatePage`: grid dimensions, palette membership, header format, fastext count and colors
  - [x] 2.2 Implement `Page` / `Row` / `Cell` types and `validatePage()` until green
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 5.2, 5.3_

- [x] 3. Typesetter
  - [x] 3.1 Write failing tests: word wrap at 40 columns, long-word truncation, empty input, blank lines
  - [x] 3.2 Implement `typeset()` until green
  - [x] 3.3 Add property-based test: for arbitrary strings, no output line exceeds 40 columns
  - _Requirements: 1.4, 4.3, 5.1, 6.2_

- [x] 4. Renderer
  - [x] 4.1 Write failing tests: renders exactly 40×25 cells, header row content, fastext row colors
  - [x] 4.2 Implement the DOM-grid renderer until green
  - [x] 4.3 Add property-based test: any valid Page renders without throwing and preserves grid dimensions and palette
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 6.1_

- [x] 5. Navigation
  - Write failing tests first: keypad entry loads the target page; partial entry shows in header; unknown number shows not-found page; fastext activation navigates
  - Implement navigation controller until green
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 6. Weather connector and page 302
  - Write failing tests with injected fetch and a recorded Open-Meteo payload: parsing, typeset output, fetch-failure → stale last-good fallback, default location
  - Implement `weather.ts` and page 302 generation until green
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 7. News connector and page 101
  - Write failing tests: provider mode with key, demo-feed fallback without key, fetch-failure fallback, headline summarization to ≤40 columns
  - Implement `news.ts`, bundled demo feed, and page 101 generation until green
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 8. Page store, refresh loop, pages 100 and 888
  - Write failing tests: validation gate rejects invalid pages and keeps last-good; refresh regenerates 101/302 on interval; index page 100 and about page 888 render
  - Implement store, timer, and static pages until green
  - _Requirements: 5.1, 5.2, 5.3, 3.2_

- [x] 9. End-to-end wiring and judge readiness
  - `npm run dev` serves the complete app; demo mode works with zero API keys; all tests green; finalize README run instructions and default-location disclosure
  - _Requirements: 1–6_

- [x] 10. Final compliance pass
  - Confirm `.kiro/` (specs, hooks, steering) is committed and not gitignored; LICENSE present and detectable; no secrets in repo; add demo-video outline to `docs/`
  - _Requirements: Kiroween 2026 submission rules_

