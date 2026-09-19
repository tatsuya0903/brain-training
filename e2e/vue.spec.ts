import { test, expect } from '@playwright/test'

test('completes the base training screen flow', async ({ page }) => {
  await page.goto('./#/')

  await expect(page.getByRole('heading', { name: '暗算トレーニング' })).toBeVisible()

  await page.getByRole('link', { name: 'トレーニング開始' }).click()
  await expect(page).toHaveURL(/#\/training$/)
  await expect(page.getByText('47 + 28')).toBeVisible()

  await page.getByRole('button', { name: '5を入力' }).click()
  await page.getByRole('button', { name: '8を入力' }).click()
  await page.getByRole('button', { name: '3を入力' }).click()
  await expect(page.getByLabel('入力中の回答')).toHaveText('583')

  await page.getByRole('button', { name: '1文字削除' }).click()
  await expect(page.getByLabel('入力中の回答')).toHaveText('58')

  await page.getByRole('button', { name: '回答を決定' }).click()
  await expect(page).toHaveURL(/#\/result$/)
  await expect(page.getByRole('heading', { name: 'トレーニング結果' })).toBeVisible()

  await page.getByRole('link', { name: 'もう一度挑戦する' }).click()
  await expect(page).toHaveURL(/#\/training$/)
  await expect(page.getByText('47 + 28')).toBeVisible()
  await expect(page.getByLabel('入力中の回答')).toHaveText('未入力')
})

test('keeps the main UI within responsive viewport widths', async ({ page }) => {
  const viewports = [
    { width: 320, height: 700 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ]

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)

    for (const route of ['/', '/training', '/result']) {
      await page.goto(`./#${route}`)
      const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth)

      expect(pageWidth).toBeLessThanOrEqual(viewport.width)
    }

    await expect(page.getByRole('heading', { name: 'トレーニング結果' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'もう一度挑戦する' })).toBeVisible()
  }
})
