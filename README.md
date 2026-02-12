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

4. **Request**: `curl curl.md?url=example.com`

OrbStack automatically resolves `curl.local` to the container.

## Environment Variables

| Variable | Description |
| --- | --- |
| `BROWSER_RENDERING_API_TOKEN` | API token for [Browser Rendering](https://developers.cloudflare.com/browser-rendering/) REST API fallback |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (found in the Workers dashboard URL) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token for deployments (see [below](#creating-a-cloudflare-api-token)) |
| `TEMPO_CHAIN` | Tempo chain (`mainnet` or `testnet`) |
| `TEMPO_PRIVATE_KEY` | Private key for Tempo payment sessions |
| `TEMPO_RPC_URL` | Tempo RPC endpoint (e.g. `https://rpc.moderato.tempo.xyz`) |

## Setup

### GitHub Actions Secrets

Add the following secrets to your GitHub repository (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `BROWSER_RENDERING_API_TOKEN`
- `TEMPO_PRIVATE_KEY`

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
