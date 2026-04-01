# Build Verification Gotchas

## Middleware Deprecation Warning
Next.js 15+ shows a warning about middleware convention being deprecated.
This is a warning, not an error — the build still succeeds.

## pnpm lint May Not Work
Some projects have broken or missing ESLint configurations. If `pnpm lint`
fails with "no eslint config found", skip it and rely on typecheck + build.

## Turbopack vs Webpack Build Differences
The dev server (Turbopack) may accept code that the production build (Webpack)
rejects. Always run `pnpm build` for definitive verification, not just
`pnpm dev`.

## Generated Types Out of Date
If the build fails on API types, they may need regeneration. Check for a
`generate` script in package.json.
