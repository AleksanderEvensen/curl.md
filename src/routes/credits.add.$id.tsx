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
import { creditAmounts, pricing } from '#lib/constants.ts'

export const Route = createFileRoute('/credits/add/$id')({
  head() {
    return { meta: [{ title: `Add Credits - ${__HOST__}` }] }
  },
  loader: ({ params }) => getPayment({ data: { id: params.id } }),
  component: Component,
})

function Component() {
  const params = Route.useParams()
  const data = Route.useLoaderData()

  const { resolvedTheme } = useTheme()
  const stripePromise = React.useMemo(
    () => (data ? loadStripe(data.publishable_key) : null),
    [data?.publishable_key, data],
  )

  if (!data || !stripePromise)
    return (
      <PageWrapper
        title="Payment Session Not Found"
        description="Payment session either expired or not found. Close this page and try again."
      />
    )

  return (
    <Elements
      options={{
        appearance: {
          disableAnimations: true,
          theme: resolvedTheme === 'dark' ? 'night' : 'stripe',
          variables: {
            borderRadius: '0px',
            colorBackground: c(resolvedTheme, 'bga1'),
            colorDanger: c(resolvedTheme, 'red9'),
            colorSuccess: c(resolvedTheme, 'green9'),
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
      <CheckoutForm amount={data.amount} id={params.id} locked={data.locked} />
    </Elements>
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
    return <PageWrapper title="Payment Successful" description="Time to get curling." />

  return (
    <PageWrapper title="Add Credits" description="Add prepaid credits to your account.">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          payment.mutate()
        }}
      >
        {props.locked ? (
          <p className="text-gray8 text-sm">Amount: ${(amount / 100).toFixed(2)}</p>
        ) : (
          <RadioGroup
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            disabled={updateAmount.isPending}
            onValueChange={(value) => updateAmount.mutate(Number(value))}
            value={String(amount)}
          >
            {amounts.map((amount) => (
              <Radio.Root
                className="group border-gray-a3 text-gray8 hover:text-gray10 data-[checked]:border-gray10 data-[checked]:text-gray10 bg-gray-a1 flex items-center justify-between border px-3 py-2 text-sm select-none disabled:opacity-50"
                key={amount}
                value={String(amount)}
              >
                <span className="font-semibold">${amount / 100}</span>
                <span className="text-gray8 text-xs">~{estimateRequests(amount)} requests</span>
              </Radio.Root>
            ))}
          </RadioGroup>
        )}
        <PaymentElement
          options={{
            layout: {
              defaultCollapsed: true,
              radios: false,
              type: 'accordion',
              visibleAccordionItemsCount: 2,
            },
          }}
        />
        <button
          className="bg-gray10 text-bg1 flex h-11 items-center justify-center px-4 transition-opacity hover:opacity-90 disabled:opacity-50"
          disabled={!stripe || payment.isPending || updateAmount.isPending}
          type="submit"
        >
          {payment.isPending ? 'Processing' : 'Pay'}
        </button>
        {payment.error && <p className="text-red9 -mt-1 text-sm">{payment.error.message}</p>}
      </form>
    </PageWrapper>
  )
}

function PageWrapper(props: React.PropsWithChildren<{ description: string; title: string }>) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <Nav />
      <main className="flex flex-1 flex-col items-center px-6 pt-48 pb-32">
        <div className="flex w-full flex-col sm:max-w-sm">
          <h1 className="text-lg font-bold">{props.title}</h1>
          <p className="text-gray8 mt-2 mb-6 text-sm leading-relaxed">{props.description}</p>
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
  bga1: { light: 'hsl(0 0% 96%)', dark: 'hsl(0 0% 6%)' },
  gray8: { light: 'hsl(0 0% 49%)', dark: 'hsl(0 0% 49%)' },
  gray10: { light: 'hsl(0 0% 9%)', dark: 'hsl(0 0% 93%)' },
  blue9: { light: 'hsl(211 100% 42%)', dark: 'hsl(210 100% 66%)' },
  green9: { light: 'hsl(133 50% 32%)', dark: 'hsl(131 43% 57%)' },
  red9: { light: 'hsl(358 66% 48%)', dark: 'hsl(358 100% 69%)' },
} as const

function c(theme: 'light' | 'dark', name: keyof typeof colors) {
  const value = colors[name]
  return typeof value === 'string' ? value : value[theme]
}

function estimateRequests(amountCents: number) {
  const mills = amountCents * 10
  const costPerRequest = pricing.fetchCostMills + pricing.queryBaseCostMills * pricing.queryMarkup
  return Math.floor(mills / costPerRequest).toLocaleString()
}
