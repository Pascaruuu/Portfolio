# CLAUDE.md

talk in terse mode.

Use **pnpm exclusively**. Never commit `package-lock.json` or `yarn.lock`.

## Post-Task Verification (mandatory)

Run these in order after every task. Do not report a task complete until all pass:

```bash  
pnpm svelte-check
pnpm tsc --noEmit    
pnpm lint           
```

Fix all errors before declaring done.

## Docs Sync (mandatory when present)

These docs are local-only and may not exist in every clone. Check each exists before applying this rule — if one is missing, skip it, don't create it.

If a task changes or adds to the project's architecture (new/removed modules, changed data flow, new subsystems, changed conventions) or its product/design system (new components, tokens, patterns), update the relevant doc(s) — if present — before declaring done:

- `ARCHITECTURE.md` — architecture changes
- `PRODUCT.md` — product/UX-intent changes
- `DESIGN.md` / `DESIGN.json` — design-system changes (keep both in sync with each other)

Skip if the task didn't touch any of the above, or the relevant doc doesn't exist.

## Art Content

Gallery pieces live under `src/lib/content/art/<slug>/`. `src/lib/content/art/CONTENT.md` is the contract — read it before adding or modifying a piece. `pnpm validate:art` must pass before declaring done.
