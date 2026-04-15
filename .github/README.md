# curl.md

Fetch any URL as Markdown.

```sh
curl curl.md/example.com
```

## Usage

```sh
# Fetch page
curl curl.md/example.com

# Fetch with objective to narrow results
curl curl.md/zod.dev/error-formatting?objective=tree+error+formatting

# Pre-filter by keywords
curl "curl.md/developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch?objective=streaming+response+body&keywords=ReadableStream,getReader"
```

## CLI

```sh
# Install
curl -fsSL curl.md/install.sh | sh

# Or via npm
npm i -g curl.md

# Fetch page
md example.com

# Fetch with objective to narrow results
md zod.dev/error-formatting --objective "tree error formatting"

# Pre-filter by keywords
md developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch --objective "streaming response body" --keywords ReadableStream,getReader
```

## Development

```bash
# Install and start OrbStack
brew install orbstack
orb start

# Set up environment
cp .env.example .env

# Start dev container
docker compose up -d

# Request or open in browser
curl curl.local/example.com
open https://curl.local
```

OrbStack automatically resolves `curl.local` requests to the container.

## Deploy

Deployment and preview environment setup lives in [`/docs/dev/deploy`](https://curl.md/docs/dev/deploy).

## License

[MIT](LICENSE)
