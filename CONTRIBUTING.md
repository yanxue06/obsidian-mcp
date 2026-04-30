# Contributing

Thanks for considering a contribution. The bar for landing changes is short and clear.

## Dev loop

```bash
npm install
npm run dev      # tsc --watch
OBSIDIAN_API_KEY=... node dist/index.js
```

Point any MCP client at `node /absolute/path/to/dist/index.js` to test.

## Adding a tool

1. Create the tool in `src/tools/<area>.ts` using `defineTool({...})`.
2. Export it from the file and register it in `src/tools/index.ts`.
3. Keep the tool description **dense and concrete** — that text is what the LLM uses to decide whether to call it. Include when *not* to use it.
4. Use Zod `.describe(...)` on every parameter. Bad parameter docs = wrong tool calls.

## Code style

- TypeScript strict mode. No `any` unless commented.
- No new dependencies without a one-line justification in the PR.
- Prose comments only when the *why* isn't obvious from the code.

## PRs

- One change per PR.
- Include a "How I tested" section. Screenshots or terminal output beat prose.
- Run `npm run build` before pushing.

## Releasing

1. Bump `version` in `package.json` and `src/index.ts` (`getVersion`).
2. Tag: `git tag v0.x.y && git push --tags`.
3. The release workflow publishes to npm.
