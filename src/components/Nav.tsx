import { Link } from '@tanstack/react-router'

export function Nav(props: React.PropsWithChildren) {
  return (
    <nav className="bg-bg1 fixed inset-x-0 top-0 z-50 flex h-17 items-center px-6">
      <Link className="font-pixel text-base" to="/">
        curl.md<span className="text-gray8">/&lt;url&gt;</span>
      </Link>
      <div className="ms-auto">{props.children}</div>
    </nav>
  )
}
