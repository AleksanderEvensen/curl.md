export const sidebar = [
  {
    type: 'group',
    label: 'Introduction',
    items: [
      { type: 'link', label: 'Getting Started', path: '/getting-started' },
      { type: 'link', label: 'Installation', path: '/install' },
      { type: 'link', label: 'Why curl.md', path: '/why' },
    ],
  },
  {
    type: 'group',
    label: 'Guide',
    items: [
      { type: 'link', label: 'Features', path: '/guide/features' },
      { type: 'link', label: 'CLI', path: '/guide/cli' },
      { type: 'link', label: 'API & SDK', path: '/guide/api' },
    ],
  },
  {
    type: 'group',
    label: 'Plugins',
    items: [
      { type: 'link', label: 'Amp', path: '/plugins/amp' },
      { type: 'link', label: 'Claude', path: '/plugins/claude' },
      { type: 'link', label: 'Codex', path: '/plugins/codex' },
      { type: 'link', label: 'Cursor', path: '/plugins/cursor' },
      { type: 'link', label: 'OpenCode', path: '/plugins/opencode' },
      { type: 'link', label: 'Pi', path: '/plugins/pi' },
    ],
  },
  {
    type: 'group',
    label: 'Contributing',
    items: [
      { type: 'link', label: 'Develop', path: '/dev/develop' },
      { type: 'link', label: 'Deploy', path: '/dev/deploy' },
      { type: 'link', label: 'Kitchen Sink', path: '/dev/kitchen-sink' },
    ],
  },
] satisfies Array<SidebarItem>

export type SidebarItem =
  | { type: 'link'; label: string; path: string }
  | { type: 'group'; label: string; items: Array<SidebarItem> }
  | { type: 'separator' }
