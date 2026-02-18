# curl.md

Fetch any URL as markdown 

## Development

1. **Install OrbStack**: [orbstack.dev](https://orbstack.dev)

2. **Set up environment**:
   ```bash
   cp .env.example .env
   ```

3. **Start dev container**:
   ```bash
   docker compose up -d
   ```

4. **Request**: `curl curl.md/example.com`

OrbStack automatically resolves `curl.local` requests to the container.

## Environment Variables

## Setup

### GitHub Actions Secrets

Add the following secrets to your GitHub repository (Settings → Secrets and variables → Actions):

* `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID (found in the Workers dashboard URL)
* `CLOUDFLARE_API_TOKEN` - Cloudflare API token for deployments (see [below](#creating-a-cloudflare-api-token))

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

### WWW Redirect

Redirect `www.curl.md` to `curl.md` (non-www canonical) via [Bulk Redirects](https://developers.cloudflare.com/rules/url-forwarding/bulk-redirects/):

1. Go to [DNS Records](https://dash.cloudflare.com/?to=/:account/:zone/dns/records) for the `curl.md` zone
2. Add a proxied A record: `www` → `192.0.2.1` (placeholder; the redirect fires before it's reached)
3. Go to [Bulk Redirects](https://dash.cloudflare.com/?to=/:account/bulk-redirects)
4. Create a bulk redirect list with: `www.curl.md` → `https://curl.md` (301, preserve query string, subpath matching, preserve path suffix)
