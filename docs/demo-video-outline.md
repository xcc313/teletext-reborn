# Demo video outline (about 3 minutes)

Kiroween 2026, **Resurrection** category. Target length: 3:00. Everything shown below exists in the repository. Record at a browser zoom where the 40×25 grid fills most of the frame.

## Before recording

- `npm install`, then `npm run dev` and open http://localhost:5173. Do not create a `.env` file, so the video shows demo mode.
- Open the repository in Kiro with `.kiro/specs/teletext-reborn/tasks.md` visible.
- Have a terminal ready in the project root for `npm test`.
- Keep the browser DevTools Network tab within reach (used at 2:25).

## Script

### 0:00 – 0:15 Hook

- Show the index page 100 on screen.
- Say: "Teletext died with analog TV. This is teletext reborn: a numbered-page news and weather service, typeset into a 40×25 grid, running in the browser." Tagline: *Looks like 1985. Thinks like 2026.*

### 0:15 – 0:45 Spec-driven workflow in Kiro

- Show the `.kiro/` folder in the file tree.
  - `specs/teletext-reborn/`: `requirements.md` (EARS acceptance criteria), `design.md`, `tasks.md` (tasks 1 to 10, each with its requirement links).
  - `steering/`: `product.md`, `tech.md`, `structure.md`, `teletext-rules.md` (the authenticity rules every page must meet).
  - `hooks/`: `typecheck-on-save.json` (runs `tsc --noEmit` after a TypeScript save) and `validate-teletext-pages.json` (asks the agent to check saved page JSON against the steering rules).
- Open `tasks.md` and point at the checked-off tasks. Mention the rule at the top: write the failing test, watch it fail, then write minimal code.

### 0:45 – 1:20 Test-first evidence: red, then green

- Show one task's failing test first, then the implementation. Use the git history or the task's test file (for example `tests/pipeline/typeset.test.ts` next to `src/pipeline/typeset.ts`).
- Run `npm test` in the terminal. Show the final summary: 22 test files, 314 tests passing.
- Mention `validatePage()` as the gate: every page is checked for grid size, palette, header format and fastext row before it is stored. A page that fails is rejected and the previous page stays on screen.

### 1:20 – 1:45 Property-based testing found a real bug

- Open `tests/pipeline/typeset.pbt.test.ts`, section "typeset properties: surrogate pairs", and the regression test below it.
- Explain: the property "typeset never emits a line longer than 40 columns" held, but a second property, "output stays well-formed text", failed. Cutting an overlong word at 40 UTF-16 units could split an emoji surrogate pair and leave half a character.
- Show the fix in `src/pipeline/typeset.ts` (it drops a trailing high surrogate after the cut) and the pinned regression: 39 letters followed by an emoji gives a 39-character line.
- Point out that `src/connectors/news.ts` uses the same guard when summarizing headlines.

### 1:45 – 2:25 Live tour of the pages

Switch to the browser. Type the numbers on the keyboard, then use the on-screen keypad.

- **100**: index. Lists 101, 302 and 888.
- **101**: news headlines. The page is labelled "DEMO FEED" because no API key is set. Headlines are bundled and fictional (`public/demo-news.json`).
- **302**: weather from Open-Meteo, no key needed. Current conditions and a four-day forecast. Default location is London, disclosed in the README.
- **888**: about page. Shows demo news mode, the weather location in use (default or configured), data sources, and that no API keys are required.
- Show the partial entry while typing: press `3`, `0` and the header shows the pending digits, for example `P30-`. Press `Esc` to cancel.
- Type `404`: the teletext-styled "page not found" page appears and navigation keeps working.

### 2:25 – 2:45 Navigation: keypad and fastext

- Click the on-screen keypad (0-9 and CLR) under the screen.
- Press `r`, `g`, `y`, `c` on the keyboard. The bottom row has four fastext links: red INDEX (100), green NEWS (101), yellow WEATHER (302), cyan ABOUT (888).
- Click a fastext label in the bottom row. Each 10-column slot is clickable.

### 2:45 – 3:00 Zero keys, offline fallback, close

- Say: "No `.env`, no keys. News runs on the bundled demo feed and weather on keyless Open-Meteo. A news key (`VITE_NEWS_API_KEY`) switches page 101 to live GNews headlines."
- Offline demonstration: in DevTools, set Network to Offline and reload. Page 302 shows the "weather data unavailable" page with a red `STALE` marker in the header. Page 101 still shows the demo feed. The screen is never blank.
- Say how the same mechanism works after a successful fetch: if a later refresh fails, the last good page stays on screen with the red `STALE` marker. Pages refresh every 15 minutes, so show this through the tests (`tests/connectors/weather.test.ts`, `tests/store/integration.test.ts`) rather than waiting on camera.
- Close on the README "Built with Kiro" section: specs, steering, hooks, test-first, property-based tests. End on page 100 with the tagline.

## Notes for the recording

- Do not claim features beyond the four pages (100, 101, 302, 888). There is no other content, no AI summarization service, and no location detection. The viewer's own location is never used.
- The headlines in demo mode are fictional. Say so if asked.
- The `.kiro/` folder must be visible in the repository on camera. It is committed, not gitignored.
