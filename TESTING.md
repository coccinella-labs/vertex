# VERTEX testing contract

Every user-facing capability must be checkable from the CLI. If it can be
tapped in the browser, it must have a named automated check. No exceptions
for new features: the check lands with the feature.

## Commands

| Command | What it proves | Cost |
|---|---|---|
| `npm run health` | Toolchain, lockfile sync, hygiene, types, lint, build, bundle version, live services (GitHub, OpenRouter key, proxy, dev server) | Free, ~30s |
| `npm run verify:ui` | Every browser action mirrored: repo attach + indexing, relevance scoring, excerpt grounding, Think/Plan/Chat prompt shapes, web fetch + thin-page path, WorkLog transitions, evidence-badge data, version/changelog, key gating | Free (public APIs), ~60s |
| `VERTEX_LIVE_TEST=1 npm run verify:ui` | Adds live LLM: bad-key failure + one tiny streaming completion | One tiny completion |
| `npm run verify:live-site` | Black-box check of the served app (dev or hosted): root serves, brand asset, scripts fetchable, served version, **no leaked OpenRouter secret in public JS** | Free |

Target a host with `VERTEX_SITE_URL=https://… npm run verify:live-site`.
Local-only builds carrying the dev key: `ALLOW_BUNDLED_KEY=1 npm run verify:live-site`.

## Rules for new features

1. Each check is tagged `[UI: <surface>]` naming the browser surface it covers.
2. A failing check exits non-zero. CI-ready as is.
3. Live/token-spending checks stay behind `VERTEX_LIVE_TEST=1`.
4. Rendering, touch, and viewports cannot be CLI-checked; those stay on the
   manual phone pass. Everything else belongs in `scripts/`.
5. No em dashes in repo text, UI copy, docs, or prompts. The health check
   fails on any occurrence, and the system prompt instructs the model to
   avoid them in answers too.
