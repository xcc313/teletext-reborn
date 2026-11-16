# Technical Steering

## Stack

- Vite + TypeScript (strict mode), no UI framework — the renderer is hand-built
- DOM-grid rendering first (testable); canvas is out of MVP scope
- Vitest for unit tests, fast-check for property-based testing
- npm as package manager; Node 20+

## Development Method

- Spec-driven: implement only what requirements.md and design.md define
- TDD: failing test first, watch it fail, minimal implementation, refactor green
- PBT required for renderer invariants and typesetter line lengths
- Connectors take an injectable fetch; tests stub only the network boundary, never internal logic

## Code Rules

- Pure functions for typesetting and validation; side effects isolated in connectors/store
- No `any`; exhaustive color unions; no non-null assertions without justification
- Keep modules small and single-purpose; follow structure.md layout
- No secrets in code or repo; configuration via `.env` (gitignored) with documented defaults


