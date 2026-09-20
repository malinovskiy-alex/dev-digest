// Architectural lint for @devdigest/web.
//
// Deliberately narrow. `pnpm typecheck` already catches type errors, and the
// server has `pnpm arch` (dependency-cruiser) for its rings. What had nothing
// watching it on this side were the rules in client/AGENTS.md and the
// frontend-ui-architecture skill: which folder may import which, where data
// access lives, and whether a component folder is reachable only through its
// index.ts. Those are mechanical, so they belong here rather than in review.
//
// Broader rule sets (typescript-eslint recommended, react-hooks) can be layered
// on later — they were left out so this config lands green and every failure it
// reports is a real boundary violation rather than style noise.

import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";

// One entry per top-level route: a route may not reach into a sibling route's
// private folders. When two routes need the same thing it gets promoted to
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
  {
    ignores: [
      // Vendored code is owned elsewhere (must stay byte-identical with the
      // server copy), and .next is build output.
      "src/vendor/**",
      ".next/**",
      "node_modules/**",
    ],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      import: importPlugin,
      "jsx-a11y": jsxA11y,
      // Loaded mainly so the existing `eslint-disable react-hooks/…` comments
      // resolve; the rule itself is worth having on anyway.
      "react-hooks": reactHooks,
    },
    settings: {
      "import/resolver": {
        typescript: { project: "./tsconfig.json" },
        node: { extensions: [".ts", ".tsx"] },
      },
    },
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
                "src/lib sits below the UI. An upward import means this file is misfiled.",
            },
            {
              target: "./src/components",
              from: "./src/app",
              message:
                "Shared components cannot depend on a route. Move what they need into src/lib.",
            },
            ...routeIsolation,
          ],
        },
      ],

      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // A component folder's index.ts is its public API, so reaching
              // in from OUTSIDE is the violation. Note `src/components/<group>/`
              // is a group (diff-viewer holds DiffViewer/, FileCard/, plus a
              // shared comments.ts) — code inside a group imports its siblings
              // relatively and is not covered here.
              group: ["@/app/**/_components/*/*", "@/components/*/*/*"],
              message:
                "Import a component through its folder's index.ts, not a deep path.",
            },
            {
              // The alias exists; ../../../../../../ does not survive a move.
              // Two levels up is still the route segment a _components/ folder
              // belongs to (pulls/constants.ts beside pulls/page.tsx is the
              // established shape), so the ban starts at three.
              group: ["../../../*"],
              message:
                "Use the @/ alias instead of climbing three or more levels.",
            },
          ],
        },
      ],

      // Icon-only controls announce nothing without a name.
      "jsx-a11y/control-has-associated-label": "error",
      "jsx-a11y/anchor-has-content": "error",
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/role-has-required-aria-props": "error",

      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // The one place allowed to call fetch. Everything else goes through a hook
    // in src/lib/hooks/* so the query key, its invalidation and ApiError
    // normalisation stay in one place.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/api.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message:
            "Data access goes through a hook in src/lib/hooks/* -> src/lib/api.ts.",
        },
      ],
    },
  },
  {
    // Tests legitimately import fixtures from outside src (messages/) and mock
    // globals, so the two rules above would only produce noise there.
    files: ["src/**/*.test.{ts,tsx}", "src/test/**"],
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-globals": "off",
    },
  },
);
