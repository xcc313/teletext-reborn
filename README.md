# Teletext Reborn

**Looks like 1985. Thinks like 2026.**

Kiroween 2026 hackathon entry, **Resurrection** category. Teletext Reborn brings broadcast teletext, the blocky, numbered-page information service that died with analog TV, back as a live web terminal. News and weather are fetched, summarized and typeset into authentic 40×25 teletext pages: a glanceable, ultra-light dashboard in the style of 1985.

## Quick start

Requires Node 20 or newer.

```bash
npm install
npm run dev      # serve the terminal at http://localhost:5173
npm test         # unit + property-based tests
```

Other scripts: `npm run typecheck` (strict TypeScript) and `npm run build` (typecheck, then a production build in `dist/`).

## Demo mode: zero API keys

The app is fully working with **no configuration at all**:

- Weather (page 302) uses [Open-Meteo](https://open-meteo.com), which needs no key.
- News (page 101) shows a bundled sample feed from `public/demo-news.json` and labels the page "DEMO FEED". The headlines are fictional.
- If the network is down, weather shows a stale "unavailable" page and news falls back to the demo feed. The app never shows a blank screen. A page that was fetched once and then fails to refresh keeps its last good content with a red `STALE` marker in the header.

Pages refresh every 15 minutes.

## Optional configuration

Copy `.env.example` to `.env` (gitignored) and set any of these. Restart `npm run dev` afterwards.

| Variable | Effect |
|----------|--------|
| `VITE_NEWS_API_KEY` | [GNews](https://gnews.io) key. Page 101 then shows live headlines instead of the demo feed. |
| `VITE_WEATHER_LATITUDE`, `VITE_WEATHER_LONGITUDE` | Weather location for page 302. Set both, or neither. |
| `VITE_WEATHER_NAME` | Name shown on page 302 (up to 24 characters). Defaults to the coordinates. |

Vite embeds `VITE_*` values in the browser bundle, so use a free-tier, revocable news key and never commit a real one. This repository contains no keys.

### Default weather location (disclosure)

When no location is configured, page 302 shows the weather for **London, UK (51.5072° N, 0.1276° W)**, a nod to teletext's birthplace at the BBC (Ceefax, 1974). The only data sent to Open-Meteo is this latitude and longitude, from the viewer's browser. The app does not use the viewer's own location. The about page (888) states whether the default or a configured location is in use.

To use another place, set `VITE_WEATHER_LATITUDE` and `VITE_WEATHER_LONGITUDE` in `.env`, for example `48.8566` and `2.3522` with `VITE_WEATHER_NAME=Paris`. Invalid or out-of-range coordinates fall back to London.

## Pages

| Page | Content |
|------|---------|
| 100  | Index / service overview |
| 101  | Live news headlines (demo feed when no API key is set) |
| 302  | Live weather: current conditions and a four-day forecast, via Open-Meteo |
| 888  | About: news mode, weather location, data sources |

Any other number from 100 to 899 shows a teletext-styled "page not found" page, and navigation keeps working.

## Controls

| Input | Action |
|-------|--------|
| `0`-`9` | Type a page number. The partial entry (for example `P30-`) shows at the right of the header. The first digit must be 1-8, so valid pages are 100-899. |
| `r` `g` `y` `c` | Follow the red, green, yellow or cyan fastext link in the bottom row. |
| `Esc` or `Backspace` | Cancel a partial entry. |
| Click a fastext label | Follow that link. Each 10-column slot in the bottom row is clickable. |
| On-screen keypad | Buttons 0-9 and `CLR` under the screen, for viewers without a keyboard. |

## Architecture

Data flows from connectors through the content pipeline into a validated page store, and from there to the renderer.

```
Open-Meteo / news API or demo feed
        -> connectors (src/connectors)   injectable fetch
        -> pipeline   (src/pipeline)     typeset to <=40 columns, build the 40x25 page
        -> store      (src/store)        validation gate, last-good fallback, refresh loop
        -> renderer   (src/renderer)  <- nav (src/nav)   keypad, fastext, not-found
        -> DOM grid
```

```
src/
├── model/        Page/Row/Cell types and validatePage()
├── pipeline/     typeset() and the page builder
├── connectors/   weather.ts, news.ts (injectable fetch)
├── store/        page store, refresh loop, static pages 100 and 888
├── renderer/     DOM-grid renderer and teletext.css
├── nav/          keypad buffer, fastext, keyboard, not-found page
├── config.ts     optional env settings
├── app.ts        createApp(): wires everything together, fully injectable
└── main.ts       entry: boots createApp into #app
tests/            mirrors src/; *.test.ts and *.pbt.test.ts
```

Every generated page passes `validatePage()` (grid size, palette, header format, fastext row) before it is stored. A page that fails is rejected, logged, and the previous page stays on screen.

## Built with Kiro

This project is developed end-to-end with Kiro using spec-driven development:

- **Specs**: `.kiro/specs/teletext-reborn/` contains `requirements.md` (EARS acceptance criteria), `design.md` (architecture and data models), and `tasks.md` (the test-first plan executed in Kiro).
- **Steering**: `.kiro/steering/` defines product scope, tech stack, project structure, and the teletext authenticity rules every generated page must satisfy.
- **Agent hooks**: `.kiro/hooks/` validates page JSON against the authenticity rules on save and runs TypeScript checks after TS edits.
- **TDD**: each task starts with failing tests, then the minimal implementation.
- **Property-based testing**: fast-check suites assert renderer, typesetter, connector and store invariants (40×25 grid, palette, line length, validation gate) for arbitrary inputs.
- **Wiring tests**: `tests/app.test.ts` boots the whole app in happy-dom with a stubbed network and drives it with keys and clicks.

## Disclosure

The `.kiro/` planning artifacts (specs, steering, hooks) and repository scaffolding were prepared as design inputs before implementation. All application source code is implemented by Kiro during the Kiroween 2026 submission period, following the test-first task plan. No pre-existing application code is incorporated.

## License

MIT, see [LICENSE](LICENSE).
