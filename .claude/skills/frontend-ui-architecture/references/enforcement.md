# Enforcing the boundaries

Reference for `frontend-ui-architecture`. Structure decays quietly: no single
import feels wrong at the time, and a year later the folders mean nothing. This
file is how you keep that from happening — a checklist for now, a lint config
for later.

## Contents

- [Review checklist](#review-checklist)
- [The ESLint config, for when you want it mechanical](#the-eslint-config-for-when-you-want-it-mechanical)
- [What a violation usually means](#what-a-violation-usually-means)

## Review checklist

There is **no ESLint in this repository** — not in `client/`, not in any
package. Nothing mechanical checks the rules below, so they are checked by
whoever writes or reviews the change. Run through them when a diff adds or
moves a file under `client/src`.

**Placement**

- [ ] Is this at the narrowest scope that works? A component used by one route
      is in that route's `_components/`, not in `src/components/`.
- [ ] If it moved up a level, did a *second* consumer actually appear?
- [ ] Does the new file have a subject-named home, or did it land in a generic
      bucket? No new `utils/`, `helpers/` or `types/` at the top level.
- [ ] Is a user-facing string going through `next-intl` rather than sitting in
      JSX?

**Imports**

- [ ] Does anything in `src/lib/` import from `src/app/` or `src/components/`?
      That is an upward import — the file is misfiled.
- [ ] Does `src/components/` import from `src/app/`?
- [ ] Does one route's code import another route's `_components/`?
- [ ] Does any import reach past a component folder's `index.ts` into
      `helpers.ts`, `constants.ts` or `styles.ts`?
- [ ] Is `src/vendor/` untouched, and does it import nothing from the app?
- [ ] Are non-sibling imports using the `@/` alias rather than `../../..`?

**Layering**

- [ ] Any `fetch` outside `src/lib/api.ts`?
- [ ] Does `page.tsx` compute anything, or does it only compose?
- [ ] Is there logic in a component body that closes over nothing — a pure
      function that belongs in `helpers.ts`?
- [ ] Is a value stored in state that could be derived during render?
- [ ] Does a new endpoint have a hook, with its query key and invalidations in
      one place?

**Shape**

- [ ] Does the component folder follow the six-file shape, with `index.ts` as
      its only public surface?
- [ ] Is there a colocated `*.test.tsx`?
- [ ] Are new styles Tailwind rather than a new `CSSProperties` object, and is
      the component not half-migrated?

## The ESLint config, for when you want it mechanical

The repo has no ESLint today, so this config is **a starting point that has not
been run here** — install, run it, and expect to adjust the zones before
committing it.

```sh
cd client
pnpm add -D eslint @eslint/js typescript-eslint eslint-plugin-import
```

`client/eslint.config.mjs`:

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

// One entry per top-level route: a route may not reach into a sibling route's
// private folders. When two routes need the same thing, it gets promoted to
// src/components/ — that promotion is the point of the rule.
const routes = ["agents", "onboarding", "repos", "settings"];
const routeIsolation = routes.map((route) => ({
  target: `./src/app/${route}`,
  from: "./src/app",
  except: [`./${route}`],
  message:
    "Routes are private to each other. Promote shared UI to src/components/.",
}));

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { import: importPlugin },
    rules: {
      // Dependencies point one way: vendor -> lib -> components -> app.
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/lib",
              from: ["./src/app", "./src/components"],
              message:
                "src/lib is below the UI. An upward import means this file is misfiled.",
            },
            {
              target: "./src/components",
              from: "./src/app",
              message:
                "Shared components cannot depend on a route. Move what they need into src/lib.",
            },
            {
              target: "./src/vendor",
              from: ["./src/app", "./src/components", "./src/lib"],
              message:
                "src/vendor is vendored code and owns no dependency on this app.",
            },
            ...routeIsolation,
          ],
        },
      ],

      // A component folder's index.ts is its public API.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/_components/*/*", "@/components/*/*"],
              message:
                "Import a component through its folder's index.ts, not a deep path.",
            },
          ],
        },
      ],

      // fetch belongs in src/lib/api.ts only. Reported everywhere, then
      // switched off for that one file below.
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Data goes through a hook in src/lib/hooks/*." },
      ],
    },
  },
  {
    files: ["src/lib/api.ts"],
    rules: { "no-restricted-globals": "off" },
  },
  {
    // Vendored code is owned elsewhere; linting it produces noise nobody acts on.
    ignores: ["src/vendor/**", ".next/**"],
  },
);
```

Add `"lint": "eslint src"` to `client/package.json` scripts and wire it into CI
next to `typecheck`.

A caveat worth stating plainly: `import/no-restricted-paths` reasons about file
paths, so it catches the structural violations and nothing else. It will not
notice a `page.tsx` that computes, or a value in state that should be derived.
Those stay on the human checklist.

## What a violation usually means

The useful habit is to read a boundary error as a *placement* question rather
than an import problem. Adding the import to an allowlist is almost always the
wrong fix.

| The error | What it usually means | The fix |
|---|---|---|
| `src/lib` imports from `src/components` | A React-shaped thing ended up in `lib`, or a pure thing is stuck in a component | Move the pure part down, leave the JSX up |
| Route A imports route B's `_components` | The component was never route-local | Promote it to `src/components/<kebab>/` |
| Deep import past `index.ts` | A sibling needs an internal, or the folder is doing two jobs | Export it from `index.ts`, or split the folder |
| `constants.ts` imported from elsewhere | The constant is shared | Move it to `src/lib/<subject>.ts` |
| `fetch` outside `api.ts` | The endpoint has no hook yet | Add the hook |
