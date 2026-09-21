import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { encodeSharedResult } from '../src/domain/sharing/sharedResultCodec'

const { version: packageVersion } = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
) as { version: string }

async function currentCorrectAnswer(page: Page) {
  const problem = await page.getByTestId('problem').innerText()
  const match = problem.match(/(\d+)\s*\+\s*(\d+)/)

  expect(match).not.toBeNull()
  return Number(match![1]) + Number(match![2])
}

async function answerCurrentQuestion(page: Page) {
  const answer = await currentCorrectAnswer(page)

  for (const digit of String(answer)) {
    await page.getByRole('button', { name: `${digit}を入力` }).click()
  }

  await page.getByRole('button', { name: '回答を決定' }).click()
}

async function answerCurrentQuestionWithKeyboard(page: Page, numpad = false) {
  const answer = await currentCorrectAnswer(page)

  for (const digit of String(answer)) {
    if (numpad) {
      await page.evaluate((value) => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: value,
            code: `Numpad${value}`,
            location: KeyboardEvent.DOM_KEY_LOCATION_NUMPAD,
            bubbles: true,
          }),
        )
      }, digit)
    } else {
      await page.keyboard.press(digit)
    }
  }

  if (numpad) {
    await page.evaluate(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'NumpadEnter',
          location: KeyboardEvent.DOM_KEY_LOCATION_NUMPAD,
          bubbles: true,
        }),
      )
    })
  } else {
    await page.keyboard.press('Enter')
  }
}

async function expectCorrectFeedback(page: Page) {
  await expect(page.getByTestId('answer-feedback')).toContainText('正解！')
  await expect(page.getByTestId('correct-time')).toHaveText(/^\d+\.\d{2}秒\s*$/u)
}

async function displayedSeconds(page: Page, testId: string) {
  const text = await page.getByTestId(testId).innerText()
  const seconds = Number.parseFloat(text.replace('秒', ''))

  expect(Number.isFinite(seconds)).toBe(true)
  return seconds
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
}

async function expectCalculatorNumberPad(page: Page) {
  const labels = await page
    .getByLabel('回答テンキー')
    .getByRole('button')
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')))

  expect(labels).toEqual([
    '7を入力',
    '8を入力',
    '9を入力',
    '4を入力',
    '5を入力',
    '6を入力',
    '1を入力',
    '2を入力',
    '3を入力',
    '1文字削除',
    '0を入力',
    '回答を決定',
  ])
}

test('completes, shares, restores the result, and starts a new training', async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (pattern: VibratePattern) => {
        ;(window as Window & { __vibrations?: VibratePattern[] }).__vibrations ??= []
        ;(window as Window & { __vibrations: VibratePattern[] }).__vibrations.push(pattern)
        return true
      },
    })
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
  await expect(page.getByLabel('トレーニング進捗')).toHaveAttribute('aria-valuetext', '1 / 10')
  await expect(page.locator('.progress-segment.active')).toHaveCount(1)
  await expect(page.getByTestId('elapsed-time')).toHaveText(/^\d+\.\d秒\s*$/u)
  await expectCalculatorNumberPad(page)

  await page.getByRole('button', { name: '7を入力' }).click()
  await expect(page.getByLabel('入力中の回答')).toHaveText('7')
  await page.getByRole('button', { name: '1文字削除' }).click()
  await page.getByRole('button', { name: '1を入力' }).click()
  await expect(page.getByLabel('入力中の回答')).toHaveText('1')
  await page.getByRole('button', { name: '1文字削除' }).click()

  await page.getByRole('button', { name: '0を入力' }).click()
  await page.getByRole('button', { name: '回答を決定' }).click()
  await expect(page.getByTestId('answer-feedback')).toContainText('不正解')
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as Window & { __vibrations?: VibratePattern[] }).__vibrations?.at(-1),
      ),
    )
    .toEqual([15, 40, 15])
  await expect(page.getByText('問題 1 / 10')).toBeVisible()
  await expect(page.getByLabel('入力中の回答')).toHaveText('未入力')

  await answerCurrentQuestion(page)
  await expectCorrectFeedback(page)
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as Window & { __vibrations?: VibratePattern[] }).__vibrations?.at(-1),
      ),
    )
    .toBe(30)
  await expect(page.getByText('問題 2 / 10')).toBeVisible()

  for (let questionNumber = 2; questionNumber <= 9; questionNumber += 1) {
    await expect(page.getByText(`問題 ${questionNumber} / 10`)).toBeVisible()
    await expect(page.getByLabel('トレーニング進捗')).toHaveAttribute(
      'aria-valuenow',
      String(questionNumber),
    )
    await expect(page.locator('.progress-segment.active')).toHaveCount(questionNumber)
    await answerCurrentQuestion(page)
    await expectCorrectFeedback(page)
    await expect(page.getByText(`問題 ${questionNumber + 1} / 10`)).toBeVisible()
  }
  await expect(page.getByText('問題 10 / 10')).toBeVisible()
  await expect(page.locator('.progress-segment.active')).toHaveCount(10)
  await answerCurrentQuestion(page)
  await expectCorrectFeedback(page)

  await expect(page).toHaveURL(/#\/result$/)
  await expect(page.getByRole('heading', { name: 'トレーニング結果' })).toBeVisible()

  await expect(page.getByTestId('app-icon')).toBeVisible()
  await expect(page.getByText('合計タイム', { exact: true })).toBeVisible()
  await expect(page.getByText('いつもの速さ', { exact: true })).toBeVisible()
  await expect(page.getByText('ベスト', { exact: true })).toBeVisible()
  await expect(page.getByText('平均回答時間', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '成績を共有' })).toBeVisible()
  await expect(page.getByRole('button', { name: '成績を共有' })).toHaveAttribute(
    'aria-label',
    '成績を共有',
  )

  const totalSeconds = await displayedSeconds(page, 'total-time')
  const typicalSeconds = await displayedSeconds(page, 'typical-time')
  const bestSeconds = await displayedSeconds(page, 'best-time')

  expect(totalSeconds).toBeGreaterThan(0)
  expect(typicalSeconds).toBeGreaterThan(0)
  expect(bestSeconds).toBeGreaterThanOrEqual(0)

  const displayedResult = {
    total: await displayedSeconds(page, 'total-time'),
    typical: await displayedSeconds(page, 'typical-time'),
    best: await displayedSeconds(page, 'best-time'),
  }

  const detailsToggle = page.getByRole('button', { name: '詳細結果' })
  await expect(detailsToggle).toHaveAttribute('aria-expanded', 'false')
  await detailsToggle.click()
  await expect(detailsToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByTestId('detail-row')).toHaveCount(10)
  await expect(page.getByTestId('detail-bar')).toHaveCount(10)
  for (const row of await page.getByTestId('detail-row').all()) {
    await expect(row).toContainText(/\d+\s*\+\s*\d+/u)
    await expect(row).toContainText(/\d+\.\d{2}秒/u)
  }
  for (const bar of await page.getByTestId('detail-bar').all()) {
    await expect(bar).toHaveAttribute('style', /width:\s*\d+(?:\.\d+)?%;/u)
  }
  const localDetails = await page.getByTestId('detail-row').allInnerTexts()
  await detailsToggle.click()
  await expect(detailsToggle).toHaveAttribute('aria-expanded', 'false')

  await page.getByRole('button', { name: '成績を共有' }).click()
  await expect(page.getByRole('dialog', { name: '成績を共有' })).toBeVisible()
  await page.getByLabel('プレイヤー名').fill('広島の父')
  await page.getByRole('button', { name: '共有する' }).click()
  await expect(page.getByRole('status')).toContainText('共有URLをコピーしました')
  await page.getByRole('button', { name: '閉じる' }).click()
  await expect(page.getByRole('dialog', { name: '成績を共有' })).toBeHidden()

  const sharedUrl = await page.evaluate(
    () => (window as Window & { __sharedResultUrl?: string }).__sharedResultUrl,
  )
  expect(sharedUrl).toBeTruthy()
  expect(sharedUrl).toContain('/brain-training/#/result?s=')
  expect(sharedUrl).not.toContain('?share=')

  const sharedPage = await context.newPage()
  await sharedPage.goto(sharedUrl!)
  await expect(sharedPage.getByTestId('shared-result-heading')).toHaveText('広島の父さんの結果')
  await expect(sharedPage.getByText('いつもの速さ', { exact: true })).toBeVisible()
  expect(
    Math.abs((await displayedSeconds(sharedPage, 'total-time')) - displayedResult.total),
  ).toBeLessThanOrEqual(0.011)
  expect(
    Math.abs((await displayedSeconds(sharedPage, 'typical-time')) - displayedResult.typical),
  ).toBeLessThanOrEqual(0.011)
  expect(
    Math.abs((await displayedSeconds(sharedPage, 'best-time')) - displayedResult.best),
  ).toBeLessThanOrEqual(0.011)
  const sharedDetailsToggle = sharedPage.getByRole('button', { name: '詳細結果' })
  await sharedDetailsToggle.click()
  await expect(sharedPage.getByTestId('detail-row')).toHaveCount(10)
  for (const row of await sharedPage.getByTestId('detail-row').all()) {
    await expect(row).toContainText(/\d+\s*\+\s*\d+/u)
    await expect(row).toContainText(/\d+\.\d{2}秒/u)
  }
  const sharedDetails = await sharedPage.getByTestId('detail-row').allInnerTexts()
  for (const [index, sharedDetail] of sharedDetails.entries()) {
    const localExpression = localDetails[index]?.match(/\d+\s*\+\s*\d+/u)?.[0]
    const sharedExpression = sharedDetail.match(/\d+\s*\+\s*\d+/u)?.[0]
    const localElapsed = Number.parseFloat(localDetails[index]?.match(/\d+\.\d{2}秒/u)?.[0] ?? '')
    const sharedElapsed = Number.parseFloat(sharedDetail.match(/\d+\.\d{2}秒/u)?.[0] ?? '')
    expect(sharedExpression).toBe(localExpression)
    expect(Math.abs(sharedElapsed - localElapsed)).toBeLessThanOrEqual(0.011)
  }
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

test('completes training with regular and numpad keyboard controls', async ({ page }) => {
  await page.goto('./#/')
  await page.getByRole('button', { name: 'トレーニング開始' }).click()
  await expect(page.getByText('問題 1 / 10')).toBeVisible()

  await page.keyboard.press('7')
  await page.keyboard.press('5')
  await page.keyboard.press('3')
  await expect(page.getByLabel('入力中の回答')).toHaveText('753')
  await page.keyboard.press('Backspace')
  await expect(page.getByLabel('入力中の回答')).toHaveText('75')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await expect(page.getByLabel('入力中の回答')).toHaveText('未入力')

  const firstProblem = await page.getByTestId('problem').innerText()
  await page.keyboard.press('0')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('answer-feedback')).toContainText('不正解')
  await expect(page.getByTestId('problem')).toHaveText(firstProblem)
  await expect(page.getByLabel('入力中の回答')).toHaveText('未入力')

  await answerCurrentQuestionWithKeyboard(page)
  await expectCorrectFeedback(page)
  await expect(page.getByText('問題 2 / 10')).toBeVisible()

  await answerCurrentQuestionWithKeyboard(page, true)
  await expectCorrectFeedback(page)
  await expect(page.getByText('問題 3 / 10')).toBeVisible()

  for (let questionNumber = 3; questionNumber <= 9; questionNumber += 1) {
    await answerCurrentQuestionWithKeyboard(page, questionNumber % 2 === 0)
    await expectCorrectFeedback(page)
    await expect(page.getByText(`問題 ${questionNumber + 1} / 10`)).toBeVisible()
  }
  await answerCurrentQuestionWithKeyboard(page, true)
  await expectCorrectFeedback(page)

  await expect(page).toHaveURL(/#\/result$/)
  await expect(page.getByRole('heading', { name: 'トレーニング結果' })).toBeVisible()

  await page.getByRole('button', { name: '成績を共有' }).click()
  const playerName = page.getByLabel('プレイヤー名')
  await playerName.fill('123')
  await playerName.press('Backspace')
  await expect(playerName).toHaveValue('12')
})

test('keeps completed local results within target mobile viewports', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#/')
  await page.getByRole('button', { name: 'トレーニング開始' }).click()

  for (let questionNumber = 1; questionNumber <= 9; questionNumber += 1) {
    await answerCurrentQuestion(page)
    await expectCorrectFeedback(page)
    await expect(page.getByText(`問題 ${questionNumber + 1} / 10`)).toBeVisible()
  }
  await answerCurrentQuestion(page)
  await expectCorrectFeedback(page)

  await expect(page).toHaveURL(/#\/result$/)
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 393, height: 852 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport)
    await expect(page.getByTestId('total-time')).toBeVisible()
    await expect(page.getByTestId('typical-time')).toBeVisible()
    await expect(page.getByTestId('best-time')).toBeVisible()
    await expect(page.getByRole('button', { name: '成績を共有' })).toBeVisible()
    const retry = page.getByRole('button', { name: 'もう一度挑戦する' })
    const detailsToggle = page.getByRole('button', { name: '詳細結果' })
    await expect(retry).toBeVisible()
    await expect(detailsToggle).toBeVisible()
    await expect(detailsToggle).toHaveAttribute('aria-expanded', 'false')
    const box = await detailsToggle.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 2)
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    expect(height).toBeLessThanOrEqual(viewport.height + 2)
    await expectNoHorizontalOverflow(page)
  }
})

test('shows a safe state for a broken shared result URL', async ({ page }) => {
  await page.goto('./#/result?s=broken-value')

  await expect(page.getByRole('heading', { name: 'トレーニング結果' })).toBeVisible()
  await expect(page.getByTestId('share-error')).toContainText('この共有データは読み込めません')
  await expect(page.getByRole('link', { name: 'ホームへ戻る' })).toBeVisible()

  await page.goto('./#/result?share=removed-json-format')
  await expect(page.getByText('まだ結果がありません')).toBeVisible()
})

test('keeps mobile training controls and results within representative viewports', async ({
  page,
}) => {
  const viewports = [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 393, height: 852 },
    { width: 430, height: 932 },
  ]
  const sharedResult = encodeSharedResult({
    version: 1,
    playerName: 'モバイル利用者',
    results: [
      { leftOperand: 2, rightOperand: 3, elapsedMs: 850 },
      { leftOperand: 6, rightOperand: 3, elapsedMs: 900 },
      { leftOperand: 12, rightOperand: 13, elapsedMs: 1000 },
      { leftOperand: 21, rightOperand: 23, elapsedMs: 1100 },
      { leftOperand: 28, rightOperand: 34, elapsedMs: 1300 },
      { leftOperand: 48, rightOperand: 34, elapsedMs: 1400 },
      { leftOperand: 51, rightOperand: 50, elapsedMs: 1200 },
      { leftOperand: 62, rightOperand: 40, elapsedMs: 1300 },
      { leftOperand: 68, rightOperand: 43, elapsedMs: 1600 },
      { leftOperand: 78, rightOperand: 33, elapsedMs: 1690 },
    ],
  })

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)

    await page.goto('./#/')
    await expect(page.getByRole('heading', { name: '暗算トレーニング' })).toBeVisible()
    await expect(page.getByTestId('app-version')).toHaveText(`v${packageVersion}`)
    await expect(page.getByRole('button', { name: 'トレーニング開始' })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.getByRole('button', { name: 'トレーニング開始' }).click()
    await expect(page.getByText('問題 1 / 10')).toBeVisible()
    await expect(page.getByTestId('problem')).toBeVisible()
    await expect(page.getByLabel('入力中の回答')).toBeVisible()
    await expect(page.getByLabel('回答テンキー')).toBeVisible()
    await expect(page.locator('input')).toHaveCount(0)
    await expectCalculatorNumberPad(page)
    await expectNoHorizontalOverflow(page)

    const numberPadBox = await page.getByLabel('回答テンキー').boundingBox()
    const okButtonBox = await page.getByRole('button', { name: '回答を決定' }).boundingBox()

    expect(numberPadBox).not.toBeNull()
    expect(okButtonBox).not.toBeNull()
    expect(numberPadBox!.x).toBeGreaterThanOrEqual(0)
    expect(numberPadBox!.x + numberPadBox!.width).toBeLessThanOrEqual(viewport.width + 1)
    expect(okButtonBox!.y + okButtonBox!.height).toBeLessThanOrEqual(viewport.height + 1)

    const trainingHeight = await page.evaluate(() => document.documentElement.scrollHeight)
    expect(trainingHeight).toBeLessThanOrEqual(viewport.height + 1)

    await page.getByRole('button', { name: '0を入力' }).click()
    await page.getByRole('button', { name: '回答を決定' }).click()
    await expect(page.getByText('問題 1 / 10')).toBeVisible()

    await page.goto(`./#/result?s=${sharedResult}`)
    await expect(page.getByRole('heading', { name: 'トレーニング結果' })).toBeVisible()
    await expect(page.getByTestId('total-time')).toBeVisible()
    await expect(page.getByTestId('typical-time')).toBeVisible()
    await expect(page.getByTestId('best-time')).toBeVisible()
    await expect(page.getByText('いつもの速さ', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '詳細結果' })).toHaveCount(1)
    await expect(page.getByTestId('detail-row')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'もう一度挑戦する' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  }
})

test('keeps the desktop layout free of horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })

  for (const route of ['/', '/training', '/result']) {
    await page.goto(`./#${route}`)
    await expectNoHorizontalOverflow(page)
  }

  await expect(page.getByRole('heading', { name: 'トレーニング結果' })).toBeVisible()
  await expect(page.getByText('まだ結果がありません')).toBeVisible()
  await expect(page.getByRole('link', { name: 'ホームへ戻る' })).toBeVisible()
})

test('serves installable PWA metadata and production worker assets', async ({ page, request }) => {
  await page.goto('./#/')

  const manifestLink = page.locator('link[rel="manifest"]')
  await expect(manifestLink).toHaveAttribute('href', /manifest\.webmanifest/u)
  const manifestUrl = await manifestLink.evaluate((element: HTMLLinkElement) => element.href)
  const manifestResponse = await request.get(manifestUrl)

  expect(manifestResponse.ok()).toBe(true)
  const manifest = await manifestResponse.json()
  expect(manifest).toMatchObject({
    name: 'Brain Training',
    short_name: 'Brain Training',
    display: 'standalone',
    start_url: '/brain-training/',
    scope: '/brain-training/',
    theme_color: '#6750a4',
    background_color: '#fdf8ff',
  })
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ src: 'pwa-192x192.png', sizes: '192x192' }),
      expect.objectContaining({ src: 'pwa-512x512.png', sizes: '512x512', purpose: 'any' }),
      expect.objectContaining({ src: 'pwa-512x512.png', sizes: '512x512', purpose: 'maskable' }),
    ]),
  )

  for (const asset of ['pwa-192x192.png', 'pwa-512x512.png', 'sw.js']) {
    const response = await request.get(new URL(asset, manifestUrl).href)
    expect(response.ok()).toBe(true)
  }

  const workerResponse = await request.get(new URL('sw.js', manifestUrl).href)
  const workerSource = await workerResponse.text()
  const workboxModule = workerSource.match(/workbox-[\da-f]+/u)?.[0]

  expect(workboxModule).toBeTruthy()
  expect((await request.get(new URL(`${workboxModule}.js`, manifestUrl).href)).ok()).toBe(true)
})

test('registers the service worker with the repository scope', async ({ page }) => {
  await page.goto('./#/')

  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registrations = await navigator.serviceWorker.getRegistrations()
          return registrations.some((registration) =>
            registration.scope.endsWith('/brain-training/'),
          )
        }),
      { timeout: 10_000 },
    )
    .toBe(true)
})

test('serves the precached app shell after the connection drops @offline', async ({
  page,
  context,
}) => {
  await page.goto('./#/')
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {
      timeout: 10_000,
    })
    .toBe(true)

  await context.setOffline(true)
  await page.reload()

  await expect(page.getByRole('heading', { name: '暗算トレーニング' })).toBeVisible()
  await page.getByRole('button', { name: 'トレーニング開始' }).click()
  await expect(page.getByText('問題 1 / 10')).toBeVisible()
  await expect(page.getByLabel('回答テンキー')).toBeVisible()

  await context.setOffline(false)
})
