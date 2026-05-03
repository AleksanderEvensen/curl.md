<p>
  <a href="https://curl.md">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/wevm/curl.md/main/public/dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/wevm/curl.md/main/public/light.svg">
      <img src="https://raw.githubusercontent.com/wevm/curl.md/main/public/light.svg" alt="curl.md" height="40" style="width: auto;">
    </picture>
  </a>
  <br>
</p>

# @curl.md/claude - URL to markdown for Claude

Turn websites into **optimized, low token output** to **supercharge your context**.

## Install

```sh
claude plugin marketplace add wevm/curl.md
claude plugin install curl-md@curl-md
```

To update:

```sh
claude plugin marketplace update curl-md
claude plugin install curl-md@curl-md
```

## Documentation

For full documentation, visit [curl.md/docs](https://curl.md/docs/plugins/claude)

## WebFetch Redirect

The plugin redirects built-in `WebFetch` calls to curl.md `fetch` by default. Set `webfetch_redirect` to `false` if you want to keep Claude's built-in `WebFetch` enabled.

## License

[MIT](https://github.com/wevm/curl.md/blob/main/LICENSE)
