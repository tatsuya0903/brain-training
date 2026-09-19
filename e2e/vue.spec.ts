import { test, expect, type Page } from '@playwright/test'

async function answerCurrentQuestion(page: Page) {
  const problem = await page.getByTestId('problem').innerText()
  const match = problem.match(/(\d+)\s*\+\s*(\d+)/)

  expect(match).not.toBeNull()

  const answer = Number(match![1]) + Number(match![2])

  for (const digit of String(answer)) {
    await page.getByRole('button', { name: `${digit}を入力` }).click()
  }

  await page.getByRole('button', { name: '回答を決定' }).click()
}

async function displayedSeconds(page: Page, testId: string) {
  const text = await page.getByTestId(testId).innerText()
  const seconds = Number.parseFloat(text.replace('秒', ''))

  expect(Number.isFinite(seconds)).toBe(true)
  return seconds
}

test('completes, shares, restores the result, and starts a new training', async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (url: string) => {
          ;(window as Window & { __sharedResultUrl?: string }).__sharedResultUrl = url
        },
      },
    })
  })
  await page.goto('./#/')

  await expect(page.getByRole('heading', { name: '暗算トレーニング' })).toBeVisible()

  await page.getByRole('button', { name: 'トレーニング開始' }).click()
  await expect(page).toHaveURL(/#\/training$/)
  await expect(page.getByText('問題 1 / 10')).toBeVisible()

  await page.getByRole('button', { name: '0を入力' }).click()
  await page.getByRole('button', { name: '回答を決定' }).click()
  await expect(page.getByText('問題 1 / 10')).toBeVisible()
  await expect(page.getByLabel('入力中の回答')).toHaveText('未入力')

  for (let questionNumber = 1; questionNumber <= 10; questionNumber += 1) {
    await expect(page.getByText(`問題 ${questionNumber} / 10`)).toBeVisible()
    await expect(page.getByLabel('トレーニング進捗')).toHaveAttribute(
      'aria-valuenow',
      String(questionNumber * 10),
    )
    await answerCurrentQuestion(page)
  }

  await expect(page).toHaveURL(/#\/result$/)
  await expect(page.getByRole('heading', { name: 'トレーニング結果' })).toBeVisible()
  await expect(page.getByText('10問の回答を集計しました')).toBeVisible()

  await expect(page.getByText('合計回答時間', { exact: true })).toBeVisible()
  await expect(page.getByText('平均回答時間', { exact: true })).toBeVisible()
  await expect(page.getByText('最短回答時間', { exact: true })).toBeVisible()
  await expect(page.getByText('繰り上がりなし平均', { exact: true })).toBeVisible()
  await expect(page.getByText('繰り上がりあり平均', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '考察' })).toBeVisible()
  await expect(page.getByTestId('insight')).toBeVisible()
  await expect(
    page.getByText('回答時間と問題情報の詳しい集計は、次の実装で表示します。'),
  ).toHaveCount(0)

  const totalSeconds = await displayedSeconds(page, 'total-time')
  const averageSeconds = await displayedSeconds(page, 'average-time')
  const bestSeconds = await displayedSeconds(page, 'best-time')

  expect(totalSeconds).toBeGreaterThan(0)
  expect(averageSeconds).toBeGreaterThan(0)
  expect(bestSeconds).toBeGreaterThanOrEqual(0)
  expect(Math.abs(totalSeconds - averageSeconds * 10)).toBeLessThanOrEqual(0.06)
  await expect(page.getByTestId('carry-difference')).toContainText('繰り上がり')

  const displayedResult = {
    total: await page.getByTestId('total-time').innerText(),
    average: await page.getByTestId('average-time').innerText(),
    best: await page.getByTestId('best-time').innerText(),
    noCarry: await page.getByTestId('no-carry-average').innerText(),
    carry: await page.getByTestId('carry-average').innerText(),
    difference: await page.getByTestId('carry-difference').innerText(),
  }

  await page.getByLabel('プレイヤー名').fill('広島の父')
  await page.getByRole('button', { name: '成績を共有' }).click()
  await expect(page.getByRole('status')).toContainText('共有URLをコピーしました')

  const sharedUrl = await page.evaluate(
    () => (window as Window & { __sharedResultUrl?: string }).__sharedResultUrl,
  )
  expect(sharedUrl).toBeTruthy()
  expect(sharedUrl).toContain('/brain-training/#/result?share=')

  const sharedPage = await context.newPage()
  await sharedPage.goto(sharedUrl!)
  await expect(sharedPage.getByTestId('shared-result-heading')).toHaveText('広島の父さんの結果')
  await expect(sharedPage.getByTestId('total-time')).toHaveText(displayedResult.total)
  await expect(sharedPage.getByTestId('average-time')).toHaveText(displayedResult.average)
  await expect(sharedPage.getByTestId('best-time')).toHaveText(displayedResult.best)
  await expect(sharedPage.getByTestId('no-carry-average')).toHaveText(displayedResult.noCarry)
  await expect(sharedPage.getByTestId('carry-average')).toHaveText(displayedResult.carry)
  await expect(sharedPage.getByTestId('carry-difference')).toHaveText(displayedResult.difference)
  await sharedPage.reload()
  await expect(sharedPage.getByTestId('shared-result-heading')).toHaveText('広島の父さんの結果')
  await sharedPage.getByRole('button', { name: 'もう一度挑戦する' }).click()
  await expect(sharedPage).toHaveURL(/#\/training$/)
  await expect(sharedPage.getByText('問題 1 / 10')).toBeVisible()
  await sharedPage.close()

  await page.getByRole('button', { name: 'もう一度挑戦する' }).click()
  await expect(page).toHaveURL(/#\/training$/)
  await expect(page.getByText('問題 1 / 10')).toBeVisible()
  await expect(page.getByTestId('problem')).toBeVisible()
  await expect(page.getByLabel('入力中の回答')).toHaveText('未入力')
})

test('shows a safe state for a broken shared result URL', async ({ page }) => {
  await page.goto('./#/result?share=broken-value')

  await expect(page.getByRole('heading', { name: 'トレーニング結果' })).toBeVisible()
  await expect(page.getByTestId('share-error')).toContainText('この共有データは読み込めません')
  await expect(page.getByRole('link', { name: 'ホームへ戻る' })).toBeVisible()
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
    await expect(page.getByText('まだ結果がありません')).toBeVisible()
    await expect(page.getByRole('link', { name: 'ホームへ戻る' })).toBeVisible()
  }
})
