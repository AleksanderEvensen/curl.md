# curl.md

Cloudflare Worker that fetches a URL and returns the markdown version of the page using Cloudflare's Markdown for Agents content negotiation.

## Setup

```bash
npx gitpick wevm/mpay/examples/curl.md
pnpm i
```

## Usage

Start the Worker locally:

```bash
pnpm dev
```

Then request a page:

```bash
curl "http://localhost:8787/?url=https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/"
```

## Notes

The worker requests `Accept: text/markdown, text/html` and forwards the response body. If the target site is not on Cloudflare or does not have Markdown for Agents enabled, the response will be HTML.

When the response is not markdown, the worker falls back to Workers AI `toMarkdown()` using the `AI` binding. If that fails, it calls the Browser Rendering `/markdown` REST API (requires `CLOUDFLARE_ACCOUNT_ID` and `BROWSER_RENDERING_API_TOKEN`).

All requests require payment via a Tempo session at `0.01` pathUSD per request. Provide `TEMPO_PRIVATE_KEY` in your worker environment.

## Deployment

### GitHub Actions Secrets

Add the following secrets to your GitHub repository (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID (found in the Workers dashboard URL)
- `CLOUDFLARE_API_TOKEN` - API token (see below)
- `BROWSER_RENDERING_API_TOKEN` - API token for Browser Rendering REST API fallback
- `TEMPO_PRIVATE_KEY` - Private key for Tempo payment sessions

### Creating a Cloudflare API Token

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/?to=/:account/api-tokens)
2. Click "Create Token"
3. Select "Create Custom Token"
4. Add these permissions:
   - **Account** → **Workers Scripts** → **Edit**
   - **Account** → **Workers AI** → **Edit**
   - **Zone** → **Workers Routes** → **Edit**
   - **Zone** → **Zone** → **Edit**
5. Set Account Resources to your account
6. Set Zone Resources to your domain (e.g., `curl.md`)
7. Click "Continue to summary" → "Create Token"
