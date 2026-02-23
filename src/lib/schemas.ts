import { z } from 'zod'

export const urlSchema = z
  .string()
  .transform((arg) => (arg.includes('://') ? arg : `https://${arg}`))
  .pipe(
    z.url({
      hostname: z.regexes.domain,
      normalize: true,
      protocol: /^https?$/,
    }),
  )
