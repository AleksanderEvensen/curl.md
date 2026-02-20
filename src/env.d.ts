declare namespace Cloudflare {
  interface Env {
    // Adding stronger queue types
    // https://github.com/cloudflare/workers-sdk/issues/7112
    TOKEN_UPDATE_QUEUE: Queue<{
      markdownLength: number
      requestId: string
      url: string
    }>
  }
}
