# TODO

- Remove `find ../src ../db -name '*.js' -delete` from `cli/package.json` build script once tsgo supports scoping emit to `rootDir` only. Currently tsgo emits `.js` files into `../src` and `../db` because they're pulled in transitively via `#` import aliases. See https://github.com/microsoft/typescript-go/issues/2708
- [ ] After Cloudflare releases the `workers-sdk` fix for `assets: { binding: "ASSETS" }` without `directory`, upgrade `wrangler`, `@cloudflare/vite-plugin`, and `@cloudflare/vitest-pool-workers`, then rerun `pnpm test --project workers`. Context: this repo uses that config shape in `wrangler.jsonc`. Link: https://github.com/cloudflare/workers-sdk/pull/13079
