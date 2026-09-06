<p align="center">
  <img src="https://raw.githubusercontent.com/Coccinella-Labs/vertex/main/.github/assets/thumbnail.png" alt="vertex" width="100%">
</p>

<img src=".github/assets/thumbnail.png" alt="vertex" width="100%">

# vertex

Understand software before you change it. Paste a repo or URL, inspect the evidence, explore, think, plan.

## Run

```bash
npm run dev          # localhost:5173
npm run health       # stack + services
npm run verify:ui    # every browser action, checked from CLI
npm run verify:live-site  # black-box check of the served app
```

See `CHANGELOG.md` for the release history and `TESTING.md` for the testing contract.

## CI

GitHub Actions owns CI and verification (`.github/workflows/ci.yml`). Vercel owns deployment.

```text
Checkout
   ↓
npm ci
   ↓
npm run lint
   ↓
npm run typecheck
   ↓
npm test
   ↓
npm run build
   ↓
security/bundle check (no OpenRouter key in dist/)
```

Runs on every PR and push to `main`. Post-deploy `verify:live-site` gets its own workflow once the Vercel URL exists.
