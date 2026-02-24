# curl-md

CLI and MCP server for [curl.md](https://curl.md) — fetch any URL as Markdown.

## Install

```sh
npm install -g curl-md
```

## Usage

```sh
curl-md <url> [options]
echo <url> | curl-md [options]
```

Also available as `curlmd`.

### Options

| Option | Description |
|---|---|
| `-q, --objective <text>` | Narrow content to a specific objective |
| `-k, --keywords <words>` | Pre-filter by keywords (comma-separated) |
| `-f, --fresh` | Force fresh fetch (bypass cache) |
| `-j, --json` | Output as JSON |
| `--mcp` | Start as MCP stdio server |
| `-v, --version` | Show version |
| `-h, --help` | Show help |

### Examples

```sh
# Basic fetch
curl-md example.com

# Filter by objective
curl-md example.com -q "pricing plans"

# Filter by keywords
curl-md example.com -k "api,auth"

# Combine objective and keywords
curl-md example.com -q "authentication" -k "oauth,jwt"

# GitHub webhook payload docs
curl-md docs.github.com/en/webhooks/webhook-events-and-payloads -q "pull request webhook event payload and actions" -k "pull_request"

# MDN streaming fetch
curl-md developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch -q "streaming response body" -k "ReadableStream,getReader"

# Cloudflare D1 getting started
curl-md developers.cloudflare.com/d1/get-started -q "how to query D1 from a worker" -k "D1,bindings"

# AI SDK text generation
curl-md ai-sdk.dev/docs/ai-sdk-core/generating-text -q "how to stream text with the ai sdk" -k "streamText,generateText"

# JSON output
curl-md example.com -j

# Force fresh fetch
curl-md example.com -f
```

## MCP Server

Run as an MCP stdio server for tools that don't support MCP URLs:

```sh
curl-md --mcp
```

### Configuration

Add to your MCP client config:

```json
{
  "mcpServers": {
    "curl-md": {
      "command": "npx",
      "args": ["-y", "curl-md", "--mcp"]
    }
  }
}
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `CURL_MD_BASE_URL` | Override the base URL | `https://curl.md` |
