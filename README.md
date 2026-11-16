# Teletext Reborn

**Looks like 1985. Thinks like 2026.**

Kiroween 2026 hackathon entry — **Resurrection** category. Teletext Reborn brings broadcast teletext — the blocky, numbered-page information service that died with analog TV — back as a live, AI-powered web terminal. Agents fetch and summarize real-time data into authentic 40×25 teletext pages: a glanceable, ultra-light dashboard that looks like 1985 but thinks like 2026.

## Pages

| Page | Content |
|------|---------|
| 100  | Index / service overview |
| 101  | Live news headlines (bundled demo feed when no API key is configured) |
| 302  | Live weather via Open-Meteo (no API key required) |
| 888  | About / info page |

Navigate by typing a three-digit page number or clicking the colored fastext links in the bottom row — just like a real teletext TV.

## Built with Kiro

This project is developed end-to-end with Kiro using spec-driven development:

- **Specs** — `.kiro/specs/teletext-reborn/` contains `requirements.md` (EARS acceptance criteria), `design.md` (architecture and data models), and `tasks.md` (test-first implementation plan executed in Kiro).
- **Steering** — `.kiro/steering/` defines product scope, tech stack, project structure, and the teletext authenticity rules that every generated page must satisfy.
- **Agent hooks** — `.kiro/hooks/` auto-validates page JSON against the authenticity rules on save and runs TypeScript checks after every TS edit.
- **Property-based testing** — fast-check suites assert renderer and typesetter invariants (grid dimensions, palette, line length) for arbitrary inputs.

## Getting Started

Run instructions are finalized in task 9 of the spec. Planned workflow:

```bash
npm install
npm run dev      # serve the terminal locally
npm test         # unit + property-based tests
```

The app is fully functional with **zero API keys**: weather uses keyless Open-Meteo, news falls back to a bundled demo feed. Optional configuration (news provider key, location) is documented in `.env.example` once implemented.

Default weather location: disclosed here once task 6 lands (planned default: London, as a nod to teletext's birthplace).

## Disclosure

The `.kiro/` planning artifacts (specs, steering, hooks) and repository scaffolding were prepared as design inputs before implementation. All application source code is implemented by Kiro during the Kiroween 2026 submission period, following the test-first task plan. No pre-existing application code is incorporated.

## License

MIT — see [LICENSE](LICENSE).
