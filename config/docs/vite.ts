import path from 'node:path'
import type * as vite from 'vite'
import { isCliGuideSyncPath, syncCliGuide } from './cliCommands.ts'
import { docsCompile } from './compile.ts'
import { isDocsSourcePath, syncDocsStaticAssets } from './export.ts'

const docsFullReloadPaths = new Set([path.join(process.cwd(), 'src/lib/docs.ts')])

export function docs(): vite.Plugin {
  const plugin = docsCompile() as vite.Plugin
  return {
    ...plugin,
    async configResolved(this: unknown, config: vite.ResolvedConfig) {
      await syncCliGuide()
      await syncDocsStaticAssets()
      return (
        (typeof plugin.configResolved === 'function'
          ? plugin.configResolved
          : plugin.configResolved?.handler) as
          | vite.HookHandler<NonNullable<vite.Plugin['configResolved']>>
          | undefined
      )?.call(
        this as ThisParameterType<vite.HookHandler<NonNullable<vite.Plugin['configResolved']>>>,
        config,
      )
    },
    async handleHotUpdate(this: unknown, ctx: vite.HmrContext) {
      if (docsFullReloadPaths.has(path.resolve(ctx.file))) {
        ctx.server.ws.send({ type: 'full-reload' })
        return []
      }

      const cliGuideSyncPath = isCliGuideSyncPath(ctx.file)
      const docsSourcePath = isDocsSourcePath(ctx.file)
      const cliGuideChanged = cliGuideSyncPath ? await syncCliGuide() : false

      if (docsSourcePath || cliGuideChanged) await syncDocsStaticAssets()
      if (cliGuideSyncPath && !docsSourcePath) {
        if (cliGuideChanged) ctx.server.ws.send({ type: 'full-reload' })
        return []
      }

      return (
        (typeof plugin.handleHotUpdate === 'function'
          ? plugin.handleHotUpdate
          : plugin.handleHotUpdate?.handler) as
          | vite.HookHandler<NonNullable<vite.Plugin['handleHotUpdate']>>
          | undefined
      )?.call(
        this as ThisParameterType<vite.HookHandler<NonNullable<vite.Plugin['handleHotUpdate']>>>,
        ctx,
      )
    },
  }
}
