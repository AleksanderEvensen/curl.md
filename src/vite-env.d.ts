declare const __GIT_SHA__: string
declare const __HOST__: string

declare module '*.woff2?arraybuffer' {
  const buffer: ArrayBuffer
  export default buffer
}

declare module '*.wasm?module' {
  const module: WebAssembly.Module
  export default module
}
