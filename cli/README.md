# curl-md

CLI and MCP server for [curl.md](https://curl.md) — fetch any URL as Markdown.

## Install

```sh
npm install -g curl-md
```

## Usage

```sh
# Fetch a URL as markdown
curl-md example.com

# Filter by objective
curl-md example.com -q "pricing plans"

# Filter by keywords
curl-md example.com -k "api,auth"

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
