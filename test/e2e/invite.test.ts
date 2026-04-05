import { expect } from '@playwright/test'
import { test } from '#test/e2e-utils.ts'

test('invalid token shows invalid invite page', async ({ page }) => {
  await page.goto('/invite/nonexistent-token')
  await expect(page.getByRole('heading', { name: 'Invalid Invite' })).toBeVisible()
  await expect(page.getByText('This invite link is invalid or has expired.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/')
})

test('expired invite shows invalid invite page', async ({ factory, page }) => {
  const account = await factory.account.insert({})
  const org = await factory.organization.insert({})
  const invite = await factory.organization_invite.insert({
    created_by: account.id,
    organization_id: org.id,
    expires_at: new Date(Date.now() - 86400 * 1000).toISOString(),
  })
  await page.goto(`/invite/${invite.token}`)
  await expect(page.getByRole('heading', { name: 'Invalid Invite' })).toBeVisible()
})

test('max uses exhausted shows invalid invite page', async ({ factory, page }) => {
  const account = await factory.account.insert({})
  const org = await factory.organization.insert({})
  const invite = await factory.organization_invite.insert({
    created_by: account.id,
    organization_id: org.id,
    max_uses: 1,
    use_count: 1,
  })
  await page.goto(`/invite/${invite.token}`)
  await expect(page.getByRole('heading', { name: 'Invalid Invite' })).toBeVisible()
})

test('unauthenticated user sees sign-in prompt and redirects back after login', async ({
  factory,
  page,
}) => {
  const account = await factory.account.insert({})
  const org = await factory.organization.insert({ name: 'Test Org' })
  const invite = await factory.organization_invite.insert({
    created_by: account.id,
    organization_id: org.id,
  })
  await page.goto(`/invite/${invite.token}`)
  await expect(page.getByRole('heading', { name: 'Join Test Org' })).toBeVisible()
  await expect(page.getByText('Sign in to accept this invite.')).toBeVisible()
  const link = page.getByRole('link', { name: /continue with github/i })
  await expect(link).toBeVisible()

  // Click through GitHub OAuth and verify redirect back to invite page
  await link.click()
  await page.getByRole('button', { name: /testuser/i }).click()
  await page.waitForURL(`/invite/${invite.token}`)
  await expect(page.getByRole('heading', { name: 'Join Test Org' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Join' })).toBeVisible()
})

test('authenticated user sees join button and can accept', async ({
  factory,
  page,
  setSession,
}) => {
  const account = await factory.account.insert({})
  const org = await factory.organization.insert({ name: 'My Org' })
  const invite = await factory.organization_invite.insert({
    created_by: account.id,
    organization_id: org.id,
    role: 'member',
  })
  await setSession(account.id)
  await page.goto(`/invite/${invite.token}`, { waitUntil: 'networkidle' })

  await expect(page.getByRole('heading', { name: 'Join My Org' })).toBeVisible()
  await expect(page.getByText(/invited to join.*My Org.*as a member/)).toBeVisible()

  await page.getByRole('button', { name: 'Join' }).click()
  await page.waitForURL(`/${org.login}`)
})

test('already a member shows error', async ({ factory, page, setSession }) => {
  const account = await factory.account.insert({})
  const org = await factory.organization.insert({ name: 'Existing Org' })
  await factory.organization_member.insert({
    account_id: account.id,
    organization_id: org.id,
    role: 'member',
  })
  const invite = await factory.organization_invite.insert({
    created_by: account.id,
    organization_id: org.id,
  })
  await setSession(account.id)
  await page.goto(`/invite/${invite.token}`, { waitUntil: 'networkidle' })

  await page.getByRole('button', { name: 'Join' }).click()
  await expect(page.getByText('Already a member of this organization')).toBeVisible({
    timeout: 10_000,
  })
})
