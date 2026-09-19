import { test, expect } from '@playwright/test'

// See here how to get started:
// https://playwright.dev/docs/intro
test('shows the setup confirmation at the project site URL', async ({ page }) => {
  await page.goto('./#/')

  await expect(page.getByRole('heading', { name: 'Hello, Brain Training!' })).toBeVisible()
  await expect(page.getByLabel('Brain Training')).toBeVisible()
})
