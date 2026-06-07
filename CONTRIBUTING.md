# Contributing

Thanks for considering a contribution. The bar for landing changes is short and clear.

## Dev loop

```bash
npm install
npm run dev      # tsc --watch
OBSIDIAN_API_KEY=... node dist/index.js
```

Point any MCP client at `node /absolute/path/to/dist/index.js` to test.

## Project layout

```
src/
  index.ts     entry point (stdio)        core/    pure helpers: markdown, paths,
  server.ts    builds + wires the server           note-body, file-list cache
  client/      REST client + env config   tools/   one file per tool, grouped by
                                                   category (discovery, reading,
                                                   graph, writing, commands)
tests/core/    unit tests for the pure core helpers
```

## Adding a tool

1. Create the tool at `src/tools/<category>/<tool_name>.ts` using `defineTool({...})`, where `<category>` is one of `discovery`, `reading`, `graph`, `writing`, `commands`.
2. Import it into `src/tools/index.ts` and add it to `allTools` under its category.
3. Keep the tool description **dense and concrete** — that text is what the LLM uses to decide whether to call it. Include when *not* to use it.
4. Use Zod `.describe(...)` on every parameter. Bad parameter docs = wrong tool calls.
5. Pure logic (parsing, path math) goes in `src/core/` with a unit test in `tests/core/` — not inside the tool handler.

## Tests

```bash
npm test        # node --test via tsx, against tests/core/*.test.ts
npm run lint    # type-checks src + tests (tsconfig.test.json)
```

## Code style

- TypeScript strict mode. No `any` unless commented.
- No new dependencies without a one-line justification in the PR.
- Prose comments only when the *why* isn't obvious from the code.

## PRs

- One change per PR.
- Include a "How I tested" section. Screenshots or terminal output beat prose.
- Run `npm run build` before pushing.

## Releasing

1. Bump `version` in `package.json` (the server reads it from there at runtime — single source of truth).
2. Tag: `git tag v0.x.y && git push --tags`.
3. The release workflow publishes to npm.
