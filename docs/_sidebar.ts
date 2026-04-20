export const sidebar = [
  {
    type: 'group',
    label: 'Introduction',
    items: [
      { type: 'link', label: 'Getting Started', path: '/getting-started', wip: true },
      { type: 'link', label: 'Installation', path: '/install' },
      { type: 'link', label: 'Why curl.md', path: '/why', wip: true },
    ],
  },
  {
    type: 'group',
    label: 'Guide',
    items: [
      { type: 'link', label: 'Features', path: '/guide/features', wip: true },
      { type: 'link', label: 'Agent Usage', path: '/guide/agent-usage' },
      { type: 'link', label: 'CLI', path: '/guide/cli' },
      { type: 'link', label: 'API & SDK', path: '/guide/api' },
      { type: 'link', label: 'Plugins', path: '/guide/plugins' },
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
    label: 'LLM Resources',
    items: [
      { type: 'href', href: '/docs/llms.txt', label: 'llms.txt' },
      { type: 'href', href: '/docs/llms-full.txt', label: 'llms-full.txt' },
      { type: 'link', label: 'Skills', path: '/skills', wip: true },
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
  | { type: 'link'; label: string; path: string; wip?: true }
  | { type: 'href'; href: string; label: string }
  | { type: 'group'; label: string; items: Array<SidebarItem> }
  | { type: 'separator' }
