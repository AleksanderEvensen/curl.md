import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [{ title: 'curl.md' }],
  }),
  component: Home,
})

function Home() {
  const host = __HOST__
  return (
    <>
      <h1 className="text-base font-bold">curl.md</h1>
      <p className="mt-6 text-gray9">Fetch any URL as markdown.</p>
      <pre className="mt-6 overflow-x-auto border border-gray-a3 p-4">
        <code>
          <span className="select-none">$ </span>
          {`curl ${host}/example.com`}
        </code>
      </pre>
    </>
  )
}
