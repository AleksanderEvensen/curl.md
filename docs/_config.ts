import { linkOptions } from '@tanstack/react-router'

export const config = {
  navbarLinks: [
    { label: 'Home', ...linkOptions({ to: '/home' }) },
    {
      label: 'Guide',
      ...linkOptions({
        params: { _splat: 'guide/features' },
        to: '/docs/$',
      }),
    },
    {
      label: 'Plugins',
      ...linkOptions({
        params: { _splat: 'plugins/amp' },
        to: '/docs/$',
      }),
    },
  ],
  repoBaseUrl: 'https://github.com/wevm/curl.md',
}

export type Config = typeof config
