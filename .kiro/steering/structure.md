# Project Structure Steering

```
teletext-reborn/
├── .kiro/                  # MUST stay committed — specs, hooks, steering
│   ├── specs/teletext-reborn/   # requirements.md, design.md, tasks.md
│   ├── hooks/                   # event-driven agent hooks (JSON)
│   └── steering/                # these steering documents
├── src/
│   ├── model/              # Page/Row/Cell types, validatePage()
│   ├── pipeline/           # typeset(), summarize helpers
│   ├── connectors/         # weather.ts, news.ts (injectable fetch)
│   ├── store/              # page store, last-good fallback, refresh timer
│   ├── renderer/           # DOM-grid teletext renderer
│   ├── nav/                # keypad buffer, fastext, not-found page
│   ├── app.ts              # createApp(): wires store, sources, refresh loop, nav, renderer
│   ├── config.ts           # optional env settings (news key, weather location)
│   └── main.ts             # entry: boots createApp into #app
├── tests/                  # mirrors src/ layout; *.test.ts and *.pbt.test.ts
├── public/                 # static assets, bundled demo feed JSON
├── docs/                   # demo-video outline, additional writeups
├── index.html
├── package.json
├── LICENSE                 # MIT — must be detectable in GitHub About
└── README.md
```

Rules: new source files go in the matching module directory; every production module has a mirrored test file; never place application code inside `.kiro/`.

