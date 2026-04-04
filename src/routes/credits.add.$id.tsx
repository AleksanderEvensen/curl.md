import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import * as React from 'react'
import Stripe from 'stripe'
import { z } from 'zod/mini'
import { Nav } from '#components/Nav.tsx'
import { useTheme } from '#hooks/useTheme.ts'
import { creditAmounts } from '#lib/constants.ts'

export const Route = createFileRoute('/credits/add/$id')({
  head() {
    return { meta: [{ title: `Add Credits - ${__HOST__}` }] }
  },
  loader: ({ params }) => getPayment({ data: { id: params.id } }),
  component: AddCreditsPage,
})

function AddCreditsPage() {
  const { id } = Route.useParams()
  const data = Route.useLoaderData()

  const { resolvedTheme } = useTheme()
  const stripePromise = React.useMemo(
    () => (data ? loadStripe(data.publishable_key) : null),
    [data?.publishable_key, data],
  )

  if (!data || !stripePromise)
    return (
      <PageWrapper>
        <p className="text-gray8 text-sm leading-relaxed">Payment session not found or expired.</p>
      </PageWrapper>
    )

  return (
    <PageWrapper>
      <Elements
        key={resolvedTheme}
        options={{
          appearance: {
            disableAnimations: true,
            theme: resolvedTheme === 'dark' ? 'night' : 'stripe',
            variables: {
              borderRadius: '0px',
              colorBackground: c(resolvedTheme, 'bg1'),
              colorDanger: c(resolvedTheme, 'red9'),
              colorPrimary: c(resolvedTheme, 'gray10'),
              colorText: c(resolvedTheme, 'gray10'),
              colorTextSecondary: c(resolvedTheme, 'gray8'),
              fontFamily: '"Geist Mono Variable", monospace',
              fontSizeBase: '14px',
            },
          },
          clientSecret: data.pi_secret,
          customerSessionClientSecret: data.cs_secret,
        }}
        stripe={stripePromise}
      >
        <CheckoutForm amount={data.amount} id={id} locked={data.locked} />
      </Elements>
    </PageWrapper>
  )
}

const amounts = creditAmounts.map(Number)

function CheckoutForm(props: { amount: number; id: string; locked: boolean }) {
  const stripe = useStripe()
  const elements = useElements()
  const [amount, setAmount] = React.useState(props.amount)

  const updateAmount = useMutation({
    async mutationFn(newAmount: number) {
      await changeAmount({ data: { id: props.id, amount: newAmount } })
      setAmount(newAmount)
    },
  })

  const payment = useMutation({
    async mutationFn() {
      if (!stripe || !elements) throw new Error('Stripe not loaded.')
      const result = await stripe.confirmPayment({
        confirmParams: { return_url: window.location.href },
        elements,
        redirect: 'if_required',
      })
      if (result.error) throw new Error(result.error.message ?? 'Payment failed.')
    },
    onSuccess() {
      void deletePayment({ data: { id: props.id } })
    },
  })

  if (payment.isSuccess)
    return (
      <div className="flex flex-col gap-1 py-8">
        <p className="text-lg font-bold">Payment successful</p>
        <p className="text-gray8 text-sm leading-relaxed">You can close this page.</p>
      </div>
    )

  return (
    <form
      className="mt-4 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        payment.mutate()
      }}
    >
      <PaymentElement
        options={{
          layout: {
            type: 'accordion',
            defaultCollapsed: true,
            radios: false,
            spacedAccordionItems: true,
            visibleAccordionItemsCount: 3,
          },
        }}
      />
      {props.locked ? (
        <p className="text-gray8 text-sm">Amount: ${(amount / 100).toFixed(2)}</p>
      ) : (
        <RadioGroup
          className="border-gray-a3 divide-gray-a3 flex flex-col divide-y border border-b-0 sm:flex-row sm:divide-x sm:border-e-0"
          disabled={updateAmount.isPending}
          onValueChange={(value) => updateAmount.mutate(Number(value))}
          value={String(amount)}
        >
          {amounts.map((a) => (
            <Radio.Root
              className="text-gray9 hover:text-gray10 data-[checked]:bg-gray10 data-[checked]:text-bg1 flex-1 px-3 py-2 text-center text-sm select-none disabled:opacity-50"
              key={a}
              value={String(a)}
            >
              ${a / 100}
            </Radio.Root>
          ))}
        </RadioGroup>
      )}
      <button
        className="bg-gray10 text-bg1 flex h-11 items-center justify-center px-4 transition-opacity hover:opacity-90 disabled:opacity-50"
        disabled={!stripe || payment.isPending || updateAmount.isPending}
        type="submit"
      >
        {payment.isPending ? 'Processing' : 'Pay'}
      </button>
      {payment.error && <p className="text-red9 -mt-1 text-sm">{payment.error.message}</p>}
    </form>
  )
}

function PageWrapper(props: React.PropsWithChildren) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <Nav />
      <main className="flex flex-1 flex-col items-center justify-center px-6 pt-17 pb-32">
        <div className="flex w-full max-w-sm flex-col">
          <h1 className="mb-4 text-lg font-bold">Add Credits</h1>
          {props.children}
        </div>
      </main>
    </div>
  )
}

const paymentInput = z.object({ id: z.string() })

const getPayment = createServerFn({ method: 'GET' })
  .inputValidator((data) => z.parse(paymentInput, data))
  .handler(async (c) => {
    const data = await env.KV.get(`payment:${c.data.id}`, 'json')
    if (!data) return null
    return { ...data, publishable_key: env.STRIPE_PUBLISHABLE_KEY }
  })

const allowedAmounts = new Set(amounts)

const changeAmount = createServerFn({ method: 'POST' })
  .inputValidator((data) => z.parse(z.object({ id: z.string(), amount: z.number() }), data))
  .handler(async (c) => {
    if (!allowedAmounts.has(c.data.amount)) throw new Error('invalid_amount')
    const data = await env.KV.get(`payment:${c.data.id}`, 'json')
    if (!data || data.locked) throw new Error('not_found')
    const stripe = new Stripe(env.STRIPE_SECRET_KEY)
    const piId = data.pi_secret.slice(0, data.pi_secret.indexOf('_secret_'))
    await stripe.paymentIntents.update(piId, { amount: c.data.amount })
    await env.KV.put(`payment:${c.data.id}`, JSON.stringify({ ...data, amount: c.data.amount }), {
      expirationTtl: 1800,
    })
  })

const deletePayment = createServerFn({ method: 'POST' })
  .inputValidator((data) => z.parse(paymentInput, data))
  .handler(async (c) => {
    await env.KV.delete(`payment:${c.data.id}`)
  })

// Mirrors light-dark() values from styles.css @theme
// lightningcss compiles light-dark() so getComputedStyle can't resolve them
const colors = {
  bg1: { light: 'hsl(0 0% 98%)', dark: 'hsl(0 0% 0%)' },
  gray8: { light: 'hsl(0 0% 49%)', dark: 'hsl(0 0% 49%)' },
  gray10: { light: 'hsl(0 0% 9%)', dark: 'hsl(0 0% 93%)' },
  red9: { light: 'hsl(358 66% 48%)', dark: 'hsl(358 100% 69%)' },
} as const

function c(theme: 'light' | 'dark', name: keyof typeof colors) {
  const value = colors[name]
  return typeof value === 'string' ? value : value[theme]
}
